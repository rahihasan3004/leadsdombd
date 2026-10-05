import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ? `SET (starts with: ${process.env.AUTH_GOOGLE_ID.slice(0, 10)}...)` : "MISSING",
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ? `SET (length: ${process.env.AUTH_GOOGLE_SECRET.length})` : "MISSING",
    AUTH_SECRET: process.env.AUTH_SECRET ? "SET" : "MISSING",
    AUTH_URL: process.env.AUTH_URL || "MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  });
}
