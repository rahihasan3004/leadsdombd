import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db, type Prisma } from "@fine-leads/database";
import {
  LeadExportError,
  parseExportOptions,
  exportTerritoryLabel,
} from "@/lib/export-options";
import {
  prepareLeadExport,
  preparedExportStream,
  type PreparedLeadExport,
} from "@/lib/lead-export";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: Request) {
  let exportId: string | undefined, prepared: PreparedLeadExport | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const options = parseExportOptions(new URL(req.url).searchParams);
    if (options.purchaseId) {
      const purchase = await db.leadPurchase.findFirst({
        where: {
          id: options.purchaseId,
          userId: session.user.id,
          status: "COMPLETED",
        },
        select: { id: true },
      });
      if (!purchase)
        return NextResponse.json(
          { error: "Purchase not found or not authorized" },
          { status: 403 },
        );
    }
    const where: Prisma.UnlockedLeadWhereInput = {
      userId: session.user.id,
      ...(options.purchaseId ? { purchaseId: options.purchaseId } : {}),
      purchase: { status: "COMPLETED" },
      ...(!options.all
        ? {
            agent: {
              state:
                options.states.length === 1
                  ? options.states[0]
                  : { in: options.states },
            },
          }
        : {}),
    };
    const agentCount = await db.unlockedLead.count({ where });
    if (!agentCount)
      return NextResponse.json(
        { error: "No unlocked leads available for this export" },
        { status: 404 },
      );
    const record = await db.leadExport.create({
      data: {
        userId: session.user.id,
        format: options.format === "json" ? "JSON" : "CSV",
        agentCount,
        status: "PROCESSING",
        searchQuery: {
          states: options.all ? "ALL" : options.states,
          grouping: options.grouping,
          container:
            options.grouping === "split" ? "ZIP" : options.format.toUpperCase(),
          exportedAt: new Date().toISOString(),
          purchaseId: options.purchaseId ?? null,
        },
      },
    });
    exportId = record.id;
    prepared = await prepareLeadExport(
      where,
      agentCount,
      options.format,
      options.grouping,
      req.signal,
    );
    // Audit marks a fully prepared artifact, not proof the customer received every byte.
    await db.leadExport
      .update({
        where: { id: record.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      })
      .catch(() =>
        console.warn("[EXPORT_AUDIT_UPDATE_DEFERRED]", { exportId: record.id }),
      );
    const ext = options.grouping === "split" ? "zip" : options.format;
    const filename = `leadsdom-export-${exportTerritoryLabel(options.all, options.states)}-${Date.now()}.${ext}`;
    const size = prepared.size;
    const stream = await preparedExportStream(prepared, req.signal);
    const response = new NextResponse(stream, {
      headers: {
        "Content-Type":
          ext === "zip"
            ? "application/zip"
            : ext === "json"
              ? "application/json; charset=utf-8"
              : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    prepared = undefined; // Stream owns cleanup from this point.
    return response;
  } catch (error) {
    await prepared?.cleanup().catch(() => undefined);
    if (exportId)
      await db.leadExport
        .update({ where: { id: exportId }, data: { status: "FAILED" } })
        .catch(() =>
          console.warn("[EXPORT_AUDIT_UPDATE_DEFERRED]", { exportId }),
        );
    console.error("[EXPORT_PREPARATION_FAILED]", {
      exportId,
      code:
        error instanceof LeadExportError ? error.status : "PREPARATION_ERROR",
    });
    return NextResponse.json(
      {
        error:
          error instanceof LeadExportError
            ? error.message
            : "Export could not be prepared. Please retry.",
      },
      {
        status: error instanceof LeadExportError ? error.status : 503,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
