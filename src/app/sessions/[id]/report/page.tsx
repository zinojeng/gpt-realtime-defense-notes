import { Suspense } from "react";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">載入中…</div>}>
      <ReportClient sessionId={id} />
    </Suspense>
  );
}
