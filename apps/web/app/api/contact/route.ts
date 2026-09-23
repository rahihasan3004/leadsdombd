import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, message } = body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    console.log("Support ticket:", { name, email, message });

    return NextResponse.json({ success: true, message: "Support ticket submitted!" });
  } catch (error) {
    console.error("Support ticket error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
