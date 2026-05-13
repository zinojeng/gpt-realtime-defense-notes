"use client";

import { formatTime } from "@/lib/format";
import type { StageSummary } from "@/types/session";

export interface SummaryPanelProps {
  summaries: StageSummary[];
  pending?: boolean;
}

export default function SummaryPanel({ summaries, pending }: SummaryPanelProps) {
  return (
    <div className="h-[60vh] overflow-y-auto rounded-md border border-zinc-200 bg-white p-3 text-sm">
      {summaries.length === 0 && !pending && (
        <p className="text-zinc-400">
          尚無階段摘要。錄音開始後，每 5 分鐘會自動觸發；亦可手動產生。
        </p>
      )}
      <ul className="space-y-4">
        {summaries.map((s, i) => (
          <li key={s.id} className="rounded border border-zinc-100 p-3">
            <div className="mb-2 text-xs text-zinc-500">
              階段 {i + 1} · {formatTime(s.startTime)} – {formatTime(s.endTime)}
            </div>
            <pre className="whitespace-pre-wrap break-words text-zinc-800">
              {s.markdown}
            </pre>
          </li>
        ))}
        {pending && (
          <li className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            正在產生階段摘要…
          </li>
        )}
      </ul>
    </div>
  );
}
