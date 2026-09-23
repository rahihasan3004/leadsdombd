import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

const CSV_HEADERS = [
  "Company Name",
  "Email",
  "Email Status",
  "Phone Number",
  "Website",
  "Physical Address",
  "City",
  "State",
  "Zip Code",
  "Timezone",
  "Category",
  "Google Rating",
  "Review Count",
  "Google Place ID",
  "Google Maps Link",
  "Scraped At",
  "Verification Score",
  "Data Source",
] as const;

const BATCH_SIZE = 1000;

const exportQuerySchema = z.object({
  state: z.string().length(2, "State code must be 2 characters").toUpperCase(),
});

function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '""';
  const str = String(value);
  if (str === "") return '""';
  return `"${str.replace(/"/g, '""')}"`;
}

function formatCsvRow(agent: {
  brokerageName: string | null;
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  websiteUrl: string | null;
  brokerageAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  timezone: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  googlePlaceId: string | null;
  googleMapsLink: string | null;
  scrapedAt: Date | null;
  verificationScore: number | null;
  dataSource: string | null;
}): string {
  return [
    escapeCsvField(agent.brokerageName),
    escapeCsvField(agent.email),
    escapeCsvField(agent.emailStatus),
    escapeCsvField(agent.phone),
    escapeCsvField(agent.websiteUrl),
    escapeCsvField(agent.brokerageAddress),
    escapeCsvField(agent.city),
    escapeCsvField(agent.state),
    escapeCsvField(agent.zipCode?.slice(0, 5)),
    escapeCsvField(agent.timezone),
    escapeCsvField(agent.category),
    escapeCsvField(agent.rating != null ? agent.rating.toFixed(1) : null),
    escapeCsvField(agent.reviewCount),
    escapeCsvField(agent.googlePlaceId),
    escapeCsvField(agent.googleMapsLink),
    escapeCsvField(agent.scrapedAt?.toISOString() ?? null),
    escapeCsvField(agent.verificationScore),
    escapeCsvField(agent.dataSource),
  ].join(",");
}

function createCsvStream(stateCode: string, exportId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const headerLine = CSV_HEADERS.map((h) => escapeCsvField(h)).join(",") + "\n";
        controller.enqueue(encoder.encode(headerLine));

        let cursor: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const batch = await db.agent.findMany({
            where: {
              state: stateCode,
              email: { not: null },
              isDeliverable: true,
            },
            select: {
              id: true,
              brokerageName: true,
              email: true,
              emailStatus: true,
              phone: true,
              websiteUrl: true,
              brokerageAddress: true,
              city: true,
              state: true,
              zipCode: true,
              timezone: true,
              category: true,
              rating: true,
              reviewCount: true,
              googlePlaceId: true,
              googleMapsLink: true,
              scrapedAt: true,
              verificationScore: true,
              dataSource: true,
            },
            take: BATCH_SIZE,
            orderBy: { id: "asc" },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          });

          if (batch.length === 0) {
            hasMore = false;
            break;
          }

          const lines = batch.map((agent) => formatCsvRow(agent)).join("\n") + "\n";
          controller.enqueue(encoder.encode(lines));

          cursor = batch[batch.length - 1].id;

          if (batch.length < BATCH_SIZE) {
            hasMore = false;
          }
        }

        await db.leadExport.update({
          where: { id: exportId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });

        controller.close();
      } catch (err) {
        console.error("[CSV_STREAM_ERROR]:", err);

        await db.leadExport
          .update({
            where: { id: exportId },
            data: { status: "FAILED" },
          })
          .catch((updateErr) => {
            console.error("[CSV_EXPORT_FAILED_UPDATE_ERROR]:", updateErr);
          });

        controller.error(err);
      }
    },
  });
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stateCodeRaw = searchParams.get("state")?.toUpperCase()?.trim();

    if (!stateCodeRaw) {
      return NextResponse.json({ error: "State parameter is required" }, { status: 400 });
    }

    const parsedState = exportQuerySchema.safeParse({ state: stateCodeRaw });
    if (!parsedState.success) {
      return NextResponse.json(
        { error: parsedState.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const stateCode = parsedState.data.state;

    const validState = LEAD_STATES.find(
      (s) => s.code.toUpperCase() === stateCode
    );
    if (!validState) {
      return NextResponse.json({ error: "Invalid state code" }, { status: 400 });
    }

    const purchases = await db.leadPurchase.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
      select: { unlockedStates: true },
    });

    const unlockedStates = new Set(
      purchases.flatMap((p) => p.unlockedStates).map((s) => s.toUpperCase())
    );

    if (!unlockedStates.has(stateCode)) {
      return NextResponse.json(
        { error: "You have not purchased this state" },
        { status: 403 }
      );
    }

    const agentCount = await db.agent.count({
      where: {
        state: stateCode,
        email: { not: null },
        isDeliverable: true,
      },
    });

    const exportRecord = await db.leadExport.create({
      data: {
        userId: session.user.id,
        format: "CSV",
        agentCount,
        status: "PROCESSING",
        searchQuery: { state: stateCode, exportedAt: new Date().toISOString() },
      },
    });

    const stateName = validState.name.toLowerCase().replace(/\s+/g, "-");
    const filename = `leadsdom-export-${stateName}-${Date.now()}.csv`;

    const stream = createCsvStream(stateCode, exportRecord.id);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[EXPORT_STREAM_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to stream export" },
      { status: 500 }
    );
  }
}
