import { NextResponse } from "next/server";
import { checkSharedSecret } from "@/lib/auth";
import { callChat, requireApiKey } from "@/lib/openai-server";
import { reviewTermsPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = checkSharedSecret(request);
  if (denied) return denied;
  let body: { transcript?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const transcript = body.transcript ?? "";
  if (!transcript.trim()) {
    return NextResponse.json(
      { error: "Missing transcript" },
      { status: 400 },
    );
  }
  try {
    const apiKey = requireApiKey();
    const markdown = await callChat({
      userPrompt: reviewTermsPrompt(transcript),
      apiKey,
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
