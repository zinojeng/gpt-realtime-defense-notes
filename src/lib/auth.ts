import { NextResponse } from "next/server";

/**
 * Optional shared-secret check for API routes that proxy OpenAI calls.
 * Set APP_SHARED_SECRET in your environment for any public deployment
 * (e.g. Zeabur). Clients then send `x-app-secret: <secret>` on every
 * request. When the env var is empty the routes are open — only acceptable
 * for local development or trusted networks.
 */
export function checkSharedSecret(request: Request): NextResponse | null {
  const expected = process.env.APP_SHARED_SECRET?.trim();
  if (!expected) return null;
  const got = request.headers.get("x-app-secret");
  if (got !== expected) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid x-app-secret header." },
      { status: 401 },
    );
  }
  return null;
}
