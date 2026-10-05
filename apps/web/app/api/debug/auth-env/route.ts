import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || "none",
    VERCEL_URL: process.env.VERCEL_URL || "none",
    googleAuth: {
      has_AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
      has_GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
      resolved_google_id_preview: googleId ? `${googleId.slice(0, 12)}...${googleId.slice(-8)}` : "MISSING",
      has_AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
      has_GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      resolved_google_secret_length: googleSecret ? googleSecret.length : 0,
    },
    secretsAndUrls: {
      has_AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      has_NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
      AUTH_URL: process.env.AUTH_URL || "NOT_SET",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT_SET",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "NOT_SET",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT_SET",
    },
  });
}
