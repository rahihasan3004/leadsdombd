import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name: string;
    description?: string;
    query: Record<string, unknown>;
  };

  const savedList = await db.savedList.create({
    data: {
      name: body.name,
      description: body.description,
      query: body.query as any,
      userId: session.user.id,
      organizationId: session.user.organizationId ?? "",
    },
  });

  return NextResponse.json({ list: savedList }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lists = await db.savedList.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ lists });
}