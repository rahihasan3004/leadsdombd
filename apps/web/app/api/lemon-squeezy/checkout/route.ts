import type { NextRequest } from "next/server";
import { handleCheckoutRequest } from "@/lib/checkout-handler";

export async function POST(req: NextRequest) {
  return handleCheckoutRequest(req);
}
