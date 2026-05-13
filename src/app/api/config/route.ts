import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const summaryIntervalMs = Number(
    process.env.SUMMARY_INTERVAL_MS ??
      process.env.NEXT_PUBLIC_SUMMARY_INTERVAL_MS ??
      5 * 60 * 1000,
  );
  return NextResponse.json({
    summaryIntervalMs:
      Number.isFinite(summaryIntervalMs) && summaryIntervalMs > 0
        ? summaryIntervalMs
        : 5 * 60 * 1000,
    sharedSecretRequired: Boolean(process.env.APP_SHARED_SECRET?.trim()),
  });
}
