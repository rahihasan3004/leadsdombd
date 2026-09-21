import { NextRequest, NextResponse } from "next/server";
import { db } from "@fine-leads/database";
// ... other imports

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ... rest of your code
}