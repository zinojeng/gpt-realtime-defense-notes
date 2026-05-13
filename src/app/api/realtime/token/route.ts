import { NextResponse } from "next/server";
import { checkSharedSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-transcribe";

export async function POST(request: Request) {
  const denied = checkSharedSecret(request);
  if (denied) return denied;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured on the server." },
      { status: 500 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = (await request.json()) as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : DEFAULT_MODEL;
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "zh";
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim()
      : undefined;

  const payload = {
    input_audio_format: "pcm16",
    input_audio_transcription: {
      model,
      language,
      ...(prompt ? { prompt } : {}),
    },
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 600,
    },
    input_audio_noise_reduction: { type: "near_field" },
  };

  const resp = await fetch(
    "https://api.openai.com/v1/realtime/transcription_sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await resp.text();
  if (!resp.ok) {
    return NextResponse.json(
      { error: "OpenAI transcription_sessions failed", status: resp.status, body: text },
      { status: 502 },
    );
  }

  try {
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse OpenAI response", body: text },
      { status: 502 },
    );
  }
}
