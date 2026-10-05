import { handlers } from "@fine-leads/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    return await handlers.GET(req);
  } catch (error: any) {
    console.error("[AUTH_ROUTE_FATAL_GET]", {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
      stack: error?.stack,
    });
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req);
  } catch (error: any) {
    console.error("[AUTH_ROUTE_FATAL_POST]", {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
      stack: error?.stack,
    });
    throw error;
  }
}
