import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processNextFulfillment } from "@/lib/scraper/order-fulfillment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Scheduler-authenticated poller. Never trust user-supplied webhook results/run IDs. */
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
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processNextFulfillment();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Fulfillment worker failed; the durable job will be retried" },
      { status: 500 },
    );
  }
}
export const POST = GET;
