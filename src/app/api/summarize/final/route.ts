import { NextResponse } from "next/server";
import { checkSharedSecret } from "@/lib/auth";
import { callChat, requireApiKey } from "@/lib/openai-server";
import { finalReportPrompt } from "@/lib/prompts";
import type { OralDefenseSession } from "@/types/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = checkSharedSecret(request);
  if (denied) return denied;
  let body: {
    session?: OralDefenseSession;
    stageSummaries?: string;
    fullTranscript?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session, stageSummaries = "", fullTranscript = "" } = body;
  if (!session || typeof session !== "object") {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }
  if (!fullTranscript.trim() && !stageSummaries.trim()) {
    return NextResponse.json(
      { error: "Need transcript or stage summaries to generate final report." },
      { status: 400 },
    );
  }

  try {
    const apiKey = requireApiKey();
    const userPrompt = finalReportPrompt(
      session,
      stageSummaries,
      fullTranscript,
    );
    const markdown = await callChat({
      userPrompt,
      apiKey,
      temperature: 0.2,
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
