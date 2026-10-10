import { mkdtemp, open, rm, stat, type FileHandle } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import ExcelJS from "exceljs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline, finished } from "node:stream/promises";
import archiver from "archiver";
import { db, type Prisma } from "@fine-leads/database";
import { redactLeadForTier } from "./lead-access";
import { SOCIAL_PROFILE_FIELDS } from "./lead-profiles";
import {
  LeadExportError,
  stateExportName,
  type LeadExportFormat,
  type LeadExportGrouping,
} from "./export-options";
const BATCH_SIZE = 1000;
const MAX_ROWS = 100_000;
const MAX_BYTES = 128 * 1024 * 1024;
const headers = [
  "Company Name",
  "Direct Phone Number",
  "Real Estate Category",
  "Physical Address",
  "City",
  "State",
  "Zip Code",
  "Timezone",
  "Website",
  "100% Deliverable Email",
  "Google Place ID",
  "Data Source",
  "Brokerage Name",
  "Review Count",
  "Star Rating",
  "Scraped Timestamp",
  "Live Google Maps Link",
] as const;
const select = {
  id: true,
  purchase: { select: { tier: true } },
  agent: {
    select: {
      brokerageName: true,
      fullName: true,
      phone: true,
      category: true,
      brokerageAddress: true,
      city: true,
      state: true,
      zipCode: true,
      timezone: true,
      websiteUrl: true,
      email: true,
      emailStatus: true,
      isDeliverable: true,
      googlePlaceId: true,
      dataSource: true,
      rating: true,
      reviewCount: true,
      scrapedAt: true,
      googleMapsLink: true,
      socialProfiles: true,
    },
  },
} satisfies Prisma.UnlockedLeadSelect;
type Unlock = Prisma.UnlockedLeadGetPayload<{ select: typeof select }>;
export function csvCell(value: unknown): string {
  let str = value == null ? "" : String(value);
  // Quoting alone does not prevent spreadsheet formula injection.
  if (/^[\s]*[=+@-]/.test(str) || /^[\t\r\n]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}
function phoneCell(phone: string | null) {
  if (!phone) return '""';
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // A formula is allowed only for an internally constructed, strictly numeric phone literal.
  return normalized.length === 10
    ? `"=""+1-${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}"""`
    : csvCell(phone);
}
export function exportLead(unlock: Unlock) {
  const lead = redactLeadForTier(unlock.agent, unlock.purchase.tier);
  // Explicit allowlist: never serialize arbitrary nested/raw email-bearing metadata.
  const result = {
    companyName: lead.brokerageName ?? lead.fullName ?? null,
    phone: lead.phone,
    category: lead.category,
    address: lead.brokerageAddress,
    city: lead.city,
    state: lead.state,
    zipCode: lead.zipCode?.slice(0, 5) ?? null,
    timezone: lead.timezone,
    website: lead.websiteUrl,
    email: lead.email,
    googlePlaceId: lead.googlePlaceId,
    dataSource: lead.dataSource ?? "SCRAPER_ENGINE",
    brokerageName: lead.brokerageName,
    reviewCount: lead.reviewCount,
    rating: lead.rating,
    scrapedAt: lead.scrapedAt?.toISOString() ?? null,
    googleMapsLink: lead.googleMapsLink,
    leadTier: unlock.purchase.tier,
  };
  if (unlock.purchase.tier !== "PHONE_ONLY")
    return { ...result, socialProfiles: lead.socialProfiles };
  // Protect against duplicate contact emails embedded in otherwise allowed text/URL fields.
  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [
      key,
      typeof value === "string"
        ? value
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}/gi, "")
            .replace(/[A-Z0-9._%+-]+%40[A-Z0-9.-]+(?:[.]|%2E)[A-Z]{2,}/gi, "")
        : value,
    ]),
  ) as typeof result;
}
export function tabularHeaders(includeBonus: boolean) {
  return [
    ...headers,
    ...(includeBonus ? SOCIAL_PROFILE_FIELDS.map((field) => field.label) : []),
  ];
}
function tabularValues(
  lead: ReturnType<typeof exportLead>,
  includeBonus: boolean,
) {
  const values: Array<string | number | null | undefined> = [
    lead.companyName,
    lead.phone,
    lead.category,
    lead.address,
    lead.city,
    lead.state,
    lead.zipCode,
    lead.timezone,
    lead.website,
    lead.email,
    lead.googlePlaceId,
    lead.dataSource,
    lead.brokerageName,
    lead.reviewCount,
    lead.rating,
    lead.scrapedAt,
    lead.googleMapsLink,
  ];
  if (includeBonus)
    values.push(
      ...SOCIAL_PROFILE_FIELDS.map((field) =>
        "socialProfiles" in lead ? lead.socialProfiles?.[field.key] : null,
      ),
    );
  return values;
}
export function tsvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // TSV has no portable quoted-cell convention when pasted; never let a field add a row/column.
  text = text.replace(/[\t\r\n]+/g, " ");
  if (/^\s*[=+@-]/.test(text) || /^0\d+$/.test(text)) text = "'" + text;
  return text;
}
async function writeExcelFile(
  source: string,
  path: string,
  includeBonus: boolean,
  check: () => void,
) {
  const output = createWriteStream(path, { mode: 0o600 });
  let outputError: Error | undefined;
  const failed = new Promise<never>((_, reject) =>
    output.once("error", (error) => {
      outputError = error;
      reject(error);
    }),
  );
  void failed.catch(() => undefined);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
    useSharedStrings: false,
  });
  workbook.creator = "LeadsDom";
  const sheet = workbook.addWorksheet("Leads", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = tabularHeaders(includeBonus).map((header, index) => ({
    header,
    width: index === 3 ? 40 : index === 0 ? 32 : 24,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 34;
  header.commit();
  const input = createReadStream(source);
  const lines = createInterface({ input, crlfDelay: Infinity });
  input.once("error", (error) => {
    outputError = error;
    lines.close();
  });
  let rows = 1;
  try {
    for await (const line of lines) {
      check();
      if (outputError) throw outputError;
      if (!line) continue;
      const lead = JSON.parse(line) as ReturnType<typeof exportLead>;
      const values = tabularValues(lead, includeBonus);
      if (
        values.some(
          (value) => typeof value === "string" && value.length > 32767,
        )
      )
        throw new LeadExportError(
          "A lead field exceeds Excel's cell size limit. Use JSON for this export.",
          413,
        );
      const row = sheet.addRow(values.map((value) => value ?? null));
      // Literal string values (never formula objects) preserve phones and leading-zero ZIPs.
      row.getCell(2).numFmt = "@";
      row.getCell(7).numFmt = "@";
      row.getCell(14).numFmt = "0";
      row.getCell(15).numFmt = "0.0";
      if (lead.scrapedAt) {
        row.getCell(16).value = new Date(lead.scrapedAt);
        row.getCell(16).numFmt = "yyyy-mm-dd hh:mm:ss";
      }
      row.commit();
      rows++;
    }
    if (outputError) throw outputError;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows, column: tabularHeaders(includeBonus).length },
    };
    sheet.commit();
    await Promise.race([workbook.commit(), failed]);
    check();
  } catch (error) {
    output.destroy();
    await finished(output).catch(() => undefined);
    throw error;
  } finally {
    lines.close();
    input.destroy();
    await finished(input).catch(() => undefined);
  }
}
function row(unlock: Unlock, format: LeadExportFormat, includeBonus: boolean) {
  const lead = exportLead(unlock);
  if (format === "json" || format === "xlsx") return JSON.stringify(lead);
  if (format === "tsv")
    return tabularValues(lead, includeBonus).map(tsvCell).join("\t");
  const fields = [
    csvCell(lead.companyName),
    phoneCell(lead.phone),
    ...[
      lead.category,
      lead.address,
      lead.city,
      lead.state,
      lead.zipCode,
      lead.timezone,
      lead.website,
      lead.email,
      lead.googlePlaceId,
      lead.dataSource,
      lead.brokerageName,
      lead.reviewCount,
      lead.rating?.toFixed(1),
      lead.scrapedAt,
      lead.googleMapsLink,
    ].map(csvCell),
  ];
  if (includeBonus)
    fields.push(
      ...SOCIAL_PROFILE_FIELDS.map((field) =>
        csvCell(
          "socialProfiles" in lead ? lead.socialProfiles?.[field.key] : null,
        ),
      ),
    );
  return fields.join(",");
}
async function queryBatch(args: Prisma.UnlockedLeadFindManyArgs) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.unlockedLead.findMany({ ...args, select });
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? error.code
          : null;
      if (
        attempt >= 2 ||
        !["P1001", "P1002", "P1017", "P2024", "P2034"].includes(String(code))
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}
export interface PreparedLeadExport {
  path: string;
  size: number;
  cleanup: () => Promise<void>;
}
/** Materialize DB-dependent work before attachment headers. Then stream completed files with backpressure.
 * This keeps DB/serialization/ZIP errors out of an already-started download; network failures can still interrupt transport.
 */
export async function prepareLeadExport(
  where: Prisma.UnlockedLeadWhereInput,
  expectedCount: number,
  format: LeadExportFormat,
  grouping: LeadExportGrouping,
  signal?: AbortSignal,
  includeBonus = true,
): Promise<PreparedLeadExport> {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1)
    throw new LeadExportError(
      "No unlocked leads available for this export",
      404,
    );
  if (expectedCount > MAX_ROWS)
    throw new LeadExportError(
      "Export exceeds 100,000 leads. Please export individual orders.",
      413,
    );
  if (format === "tsv" && expectedCount > 10_000)
    throw new LeadExportError(
      "Clipboard copy supports up to 10,000 leads. Download Excel for larger orders.",
      413,
    );
  const byteLimit = format === "tsv" ? 8 * 1024 * 1024 : MAX_BYTES;
  const dir = await mkdtemp(join(tmpdir(), "leadsdom-export-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  const files = new Map<
    string,
    { path: string; handle: FileHandle; rows: number }
  >();
  let bytes = 0,
    count = 0,
    cursor: string | undefined;
  const deadline = Date.now() + 95_000;
  const check = () => {
    if (signal?.aborted) throw new LeadExportError("Export cancelled", 499);
    if (Date.now() > deadline)
      throw new LeadExportError(
        "Export took too long. Please retry or export a smaller order.",
        503,
      );
  };
  async function write(file: { handle: FileHandle }, text: string) {
    bytes += Buffer.byteLength(text);
    if (bytes > byteLimit)
      throw new LeadExportError(
        "Export exceeds the temporary file size limit. Please export a smaller order.",
        413,
      );
    await file.handle.writeFile(text, "utf8");
  }
  try {
    while (count < expectedCount) {
      check();
      const take = Math.min(BATCH_SIZE, expectedCount - count);
      const batch = await queryBatch({
        where,
        take,
        orderBy: { id: "asc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!batch.length)
        throw new LeadExportError(
          "Lead inventory changed during export. Please retry.",
          409,
        );
      const chunks = new Map<string, string[]>();
      for (const unlock of batch) {
        check();
        const name =
          grouping === "combined"
            ? `combined.${format === "xlsx" ? "ndjson" : format}`
            : `${stateExportName(unlock.agent.state)}.${format === "xlsx" ? "ndjson" : format}`;
        let file = files.get(name);
        if (!file) {
          file = {
            path: join(dir, name),
            handle: await open(join(dir, name), "wx", 0o600),
            rows: 0,
          };
          files.set(name, file);
          await write(
            file,
            format === "csv"
              ? tabularHeaders(includeBonus).map(csvCell).join(",") + "\r\n"
              : format === "tsv"
                ? tabularHeaders(includeBonus).map(tsvCell).join("\t") + "\r\n"
                : format === "json"
                  ? "[\n"
                  : "",
          );
        }
        const chunk =
          (format === "json" && file.rows ? ",\n" : "") +
          row(unlock, format, includeBonus) +
          (format === "csv" || format === "tsv" || format === "xlsx"
            ? "\r\n"
            : "");
        const parts = chunks.get(name) ?? [];
        parts.push(chunk);
        chunks.set(name, parts);
        file.rows++;
        count++;
      }
      for (const [name, parts] of chunks)
        await write(files.get(name)!, parts.join(""));
      const next = batch[batch.length - 1]!.id;
      if (next === cursor)
        throw new LeadExportError(
          "Export pagination did not advance. Please retry.",
          503,
        );
      cursor = next;
      if (batch.length < take && count < expectedCount)
        throw new LeadExportError(
          "Lead inventory changed during export. Please retry.",
          409,
        );
    }
    if (count !== expectedCount)
      throw new LeadExportError(
        "Export record count changed. Please retry.",
        409,
      );
    for (const file of files.values()) {
      if (format === "json") await write(file, "\n]\n");
      await file.handle.close();
    }
    if (format === "xlsx") {
      let excelBytes = 0;
      for (const file of files.values()) {
        check();
        const excelPath = file.path.replace(/\.ndjson$/, ".xlsx");
        await writeExcelFile(file.path, excelPath, includeBonus, check);
        excelBytes += (await stat(excelPath)).size;
        if (excelBytes > MAX_BYTES)
          throw new LeadExportError(
            "Excel files exceed the export size limit. Export a smaller order.",
            413,
          );
        file.path = excelPath;
      }
    }
    check();
    let path = files.values().next().value!.path;
    if (grouping === "split") {
      path = join(dir, "archive.zip");
      const archive = archiver("zip", { zlib: { level: 6 } });
      const output = createWriteStream(path, { mode: 0o600 });
      archive.on("warning", () =>
        archive.destroy(new Error("ZIP_SOURCE_UNAVAILABLE")),
      );
      const abort = () => archive.destroy(new Error("EXPORT_CANCELLED"));
      signal?.addEventListener("abort", abort, { once: true });
      // Attach rejection handling immediately, before finalization can emit errors.
      const completed = pipeline(archive, output);
      const observed = completed.catch((error) => {
        throw error;
      });
      observed.catch(() => undefined);
      try {
        for (const file of files.values())
          archive.file(file.path, { name: file.path.slice(dir.length + 1) });
        await archive.finalize();
        await observed;
      } catch (error) {
        archive.destroy();
        output.destroy();
        await observed.catch(() => undefined);
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    }
    const info = await stat(path);
    if (info.size > MAX_BYTES)
      throw new LeadExportError("Export archive exceeds the size limit.", 413);
    check();
    return { path, size: info.size, cleanup };
  } catch (error) {
    await Promise.allSettled(
      [...files.values()].map((file) => file.handle.close()),
    );
    await cleanup().catch(() => undefined);
    throw error;
  }
}
export async function preparedExportStream(
  prepared: PreparedLeadExport,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  if (signal?.aborted) throw new LeadExportError("Export cancelled", 499);
  const file = await open(prepared.path, "r");
  const source = file.createReadStream({ highWaterMark: 64 * 1024 });
  const abort = () => source.destroy(new Error("EXPORT_CANCELLED"));
  signal?.addEventListener("abort", abort, { once: true });
  source.once("error", () => console.warn("[EXPORT_TRANSFER_INTERRUPTED]"));
  source.once("close", () => {
    signal?.removeEventListener("abort", abort);
    void prepared
      .cleanup()
      .catch(() => console.warn("[EXPORT_TEMP_CLEANUP_DEFERRED]"));
  });
  if (signal?.aborted) abort();
  return Readable.toWeb(source) as ReadableStream<Uint8Array>;
}
