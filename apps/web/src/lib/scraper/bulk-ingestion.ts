import { randomUUID } from "node:crypto";
import { db, Prisma } from "@fine-leads/database";
import {
  mapLobstrLead,
  type LeadContext,
  type MappedLead,
  type MappingResult,
} from "./lead-mapper";
import type { LobstrRecord } from "./lobstr-client";

export interface BulkIngestionResult {
  agentIds: string[];
  // Same source-page ordering, allowing each child cursor/candidate set to commit together.
  pageAgentIds: string[][];
  totalFetched: number;
  newlyIngested: number;
  duplicatesSkipped: number;
  closedPlacesDiscarded: number;
  invalidRecordsDiscarded: number;
}
type ExistingIdentity = {
  id: string;
  googlePlaceId: string | null;
  emailKey: string | null;
  phoneKey: string | null;
  officePhoneKey: string | null;
};
const identityKeys = (lead: MappedLead) => [
  ...(lead.data.googlePlaceId ? [`place:${lead.data.googlePlaceId}`] : []),
  ...lead.emails.map((email) => `email:${email}`),
  ...lead.phones.map((phone) => `phone:${phone.slice(-10)}`),
];
const phoneExpression = (column: "phone" | "officePhone") =>
  Prisma.sql`right(regexp_replace(regexp_replace(${Prisma.raw(`"${column}"`)}, '[[:space:]]*(ext\\.?|x|#).*$', '', 'i'), '[^0-9]', '', 'g'), 10)`;

/** Bulk read/dedup/write with PostgreSQL SSI retries; skipDuplicates alone cannot protect email/phone. */
export async function ingestLobstrPages(
  pages: Array<{ records: LobstrRecord[]; context: LeadContext }>,
  commit?: (
    tx: Prisma.TransactionClient,
    result: BulkIngestionResult,
  ) => Promise<void>,
  guard?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<BulkIngestionResult> {
  return ingestMappedPages(
    pages.map((page) =>
      page.records.map((record) => mapLobstrLead(record, page.context)),
    ),
    commit,
    guard,
  );
}

/** Shared atomic identity reconciliation for prepared/validated provider records. */
export async function ingestMappedPages(
  pages: MappingResult[][],
  commit?: (
    tx: Prisma.TransactionClient,
    result: BulkIngestionResult,
  ) => Promise<void>,
  guard?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<BulkIngestionResult> {
  const base = {
    totalFetched: 0,
    closedPlacesDiscarded: 0,
    invalidRecordsDiscarded: 0,
  };
  const leads: Array<{ page: number; lead: MappedLead }> = [];
  pages.forEach((page, index) =>
    page.forEach((mapped) => {
      base.totalFetched++;
      if (mapped.kind === "closed") base.closedPlacesDiscarded++;
      else if (mapped.kind === "invalid") base.invalidRecordsDiscarded++;
      else leads.push({ page: index, lead: mapped.lead });
    }),
  );
  if (base.totalFetched > 1_000)
    throw new Error("Bulk ingestion exceeds the bounded page limit");
  const places = [
    ...new Set(
      leads.flatMap(({ lead }) =>
        lead.data.googlePlaceId ? [lead.data.googlePlaceId] : [],
      ),
    ),
  ];
  const emails = [...new Set(leads.flatMap(({ lead }) => lead.emails))];
  const phones = [
    ...new Set(
      leads.flatMap(({ lead }) => lead.phones.map((phone) => phone.slice(-10))),
    ),
  ];
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          if (guard) await guard(tx);
          const clauses: Prisma.Sql[] = [];
          if (places.length)
            clauses.push(
              Prisma.sql`"googlePlaceId" IN (${Prisma.join(places)})`,
            );
          if (emails.length)
            clauses.push(
              Prisma.sql`lower(trim("email")) IN (${Prisma.join(emails)})`,
            );
          if (phones.length)
            clauses.push(
              Prisma.sql`(${phoneExpression("phone")} IN (${Prisma.join(phones)}) OR ${phoneExpression("officePhone")} IN (${Prisma.join(phones)}))`,
            );
          const existing = clauses.length
            ? await tx.$queryRaw<ExistingIdentity[]>(Prisma.sql`
          SELECT "id", "googlePlaceId", lower(trim("email")) AS "emailKey",
          ${phoneExpression("phone")} AS "phoneKey", ${phoneExpression("officePhone")} AS "officePhoneKey"
          FROM "Agent" WHERE ${Prisma.join(clauses, " OR ")} ORDER BY "createdAt", "id"
        `)
            : [];
          const known = new Map<string, string>();
          for (const row of existing) {
            for (const key of [
              row.googlePlaceId && `place:${row.googlePlaceId}`,
              row.emailKey && `email:${row.emailKey}`,
              row.phoneKey && `phone:${row.phoneKey}`,
              row.officePhoneKey && `phone:${row.officePhoneKey}`,
            ])
              if (key && !known.has(key)) known.set(key, row.id);
          }
          const inserts: Prisma.AgentCreateManyInput[] = [];
          const pageAgentIds = pages.map(() => new Set<string>());
          for (const { page, lead } of leads) {
            const keys = identityKeys(lead);
            // Prefer exact place identity, then contacts. Never downgrade existing verified rows.
            let id = keys
              .map((key) => known.get(key))
              .find((id) => id !== undefined);
            if (!id) {
              id = randomUUID();
              inserts.push({ ...lead.data, id });
            }
            for (const key of keys) if (!known.has(key)) known.set(key, id);
            pageAgentIds[page]!.add(id);
          }
          const saved = inserts.length
            ? await tx.agent.createMany({ data: inserts, skipDuplicates: true })
            : { count: 0 };
          if (inserts.length) {
            const present = await tx.agent.findMany({
              where: { id: { in: inserts.map((row) => row.id!) } },
              select: { id: true },
            });
            // A skipped unique conflict must retry from the winning rows, never publish invented IDs.
            if (present.length !== inserts.length)
              throw new Error("BULK_IDENTITY_CONFLICT");
          }
          const result: BulkIngestionResult = {
            ...base,
            newlyIngested: saved.count,
            duplicatesSkipped: leads.length - saved.count,
            agentIds: [...new Set(pageAgentIds.flatMap((ids) => [...ids]))],
            pageAgentIds: pageAgentIds.map((ids) => [...ids]),
          };
          if (commit) await commit(tx, result);
          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        },
      );
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
      if (
        attempt === 3 ||
        (code !== "P2034" &&
          code !== "P2002" &&
          !(
            error instanceof Error && error.message === "BULK_IDENTITY_CONFLICT"
          ))
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
  throw new Error("Bulk ingestion retries exhausted");
}
