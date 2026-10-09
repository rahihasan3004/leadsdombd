import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { advanceOrderFulfillment } from "@/lib/scraper/fulfillment-runner";
import { processPendingOrderEmails } from "@/lib/email/order-emails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel supplies Bearer CRON_SECRET; no user-supplied runs/results are trusted. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret)
    return NextResponse.json(
      { error: "Fulfillment scheduler is not configured" },
      { status: 503 },
    );
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await advanceOrderFulfillment();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Fulfillment worker failed; the durable job will be retried" },
      { status: 500 },
    );
  } finally {
    try {
      await processPendingOrderEmails();
    } catch {
      console.warn("[ORDER_EMAIL_DEFERRED]", {
        code: "OUTBOX_SCAN_UNAVAILABLE",
      });
    }
  }
}
export const POST = GET;
