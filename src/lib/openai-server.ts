import { SYSTEM_PROMPT } from "@/lib/prompts";

const SUMMARY_MODEL =
  process.env.OPENAI_SUMMARY_MODEL?.trim() || "gpt-4o-mini";

export async function callChat({
  userPrompt,
  apiKey,
  temperature = 0.2,
  model = SUMMARY_MODEL,
}: {
  userPrompt: string;
  apiKey: string;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(
      `OpenAI chat.completions failed (${resp.status}): ${text.slice(0, 500)}`,
    );
  }
  try {
    const data = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI response missing choices[0].message.content");
    }
    return content;
  } catch (err) {
    throw new Error(
      `Failed to parse OpenAI response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY not configured on the server.");
  }
  return key;
}
