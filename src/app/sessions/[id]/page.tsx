import { Suspense } from "react";
import RecordingClient from "./RecordingClient";

export const dynamic = "force-dynamic";

export default async function SessionRecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">載入中…</div>}>
      <RecordingClient sessionId={id} />
    </Suspense>
  );
}
