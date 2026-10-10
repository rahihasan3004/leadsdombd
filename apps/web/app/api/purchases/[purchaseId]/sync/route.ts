import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { advanceOrderFulfillment } from "@/lib/scraper/fulfillment-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
const SYNC_THROTTLE_MS = 8000;

/** Active owner-only sync. Never accepts provider run IDs, result data or tier overrides. */
export async function POST(
  request: Request,
  context: { params: Promise<{ purchaseId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { purchaseId } = await context.params;
    if (!purchaseId || purchaseId.length > 200)
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    const purchase = await db.leadPurchase.findFirst({
      where: { id: purchaseId, userId: session.user.id },
      select: {
        status: true,
        fulfillmentJob: { select: { id: true } },
      },
    });
    if (!purchase)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const respond = (status: string, syncStatus: string) =>
      NextResponse.json(
        { status, syncStatus },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (purchase.status !== "PROCESSING")
      return respond(purchase.status, "NOT_PENDING");
    if (!purchase.fulfillmentJob)
      return respond(purchase.status, "NO_FULFILLMENT_JOB");
    // DB throttle shared across instances/tabs; also prevents stealing an active worker lease.
    const now = new Date();
    const permission = await db.leadFulfillmentJob.updateMany({
      where: {
        id: purchase.fulfillmentJob.id,
        purchaseId,
        status: { in: ["QUEUED", "ACTIVE", "NEEDS_REVIEW"] },
        updatedAt: { lte: new Date(Date.now() - SYNC_THROTTLE_MS) },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: { updatedAt: now },
    });
    if (permission.count !== 1)
      return respond(purchase.status, "BUSY_OR_THROTTLED");
    const result = await advanceOrderFulfillment({
      purchaseId,
      budgetMs: 55_000,
      maxSteps: 4,
    });
    const current = await db.leadPurchase.findFirst({
      where: { id: purchaseId, userId: session.user.id },
      select: { status: true },
    });
    return respond(
      current?.status ?? purchase.status,
      result.outcomes.at(-1)?.status ?? "IDLE",
    );
  } catch {
    return NextResponse.json(
      { error: "Sync unavailable; your order remains queued for retry" },
      { status: 503 },
    );
  }
}
