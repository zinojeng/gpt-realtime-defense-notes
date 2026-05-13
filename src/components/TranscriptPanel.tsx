"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/format";
import type { TranscriptSegment } from "@/types/session";

export interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  livePartial?: { speakerLabel: string; text: string; startTime: number };
  onUpdate: (seg: TranscriptSegment) => void;
}

export default function TranscriptPanel({
  segments,
  livePartial,
  onUpdate,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftSpeaker, setDraftSpeaker] = useState("");

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [segments.length, livePartial?.text]);

  function beginEdit(seg: TranscriptSegment) {
    setEditingId(seg.id);
    setDraftText(seg.text);
    setDraftSpeaker(seg.speakerLabel);
  }
  function saveEdit(seg: TranscriptSegment) {
    onUpdate({
      ...seg,
      text: draftText.trim() || seg.text,
      speakerLabel: draftSpeaker.trim() || seg.speakerLabel,
      isEdited: true,
    });
    setEditingId(null);
  }

  return (
    <div
      ref={scrollRef}
      className="h-[60vh] overflow-y-auto rounded-md border border-zinc-200 bg-white p-3 text-sm"
    >
      {segments.length === 0 && !livePartial?.text && (
        <p className="text-zinc-400">尚無逐字稿。按下「開始錄音」開始。</p>
      )}
      <ul className="space-y-3">
        {segments.map((seg) => (
          <li key={seg.id} className="rounded border border-zinc-100 p-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="font-mono">
                [{formatTime(seg.startTime)}] {seg.speakerLabel}
                {seg.isEdited && <span className="ml-2 text-zinc-400">已編輯</span>}
                {seg.isImportant && <span className="ml-2 text-amber-600">★</span>}
                {seg.needsReview && (
                  <span className="ml-2 text-rose-600">⚠ 需確認</span>
                )}
              </span>
              <span className="flex gap-2">
                {editingId === seg.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(seg)}
                      className="text-emerald-700 hover:underline"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-zinc-500 hover:underline"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => beginEdit(seg)}
                      className="text-zinc-600 hover:underline"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() =>
                        onUpdate({ ...seg, isImportant: !seg.isImportant })
                      }
                      className="text-amber-600 hover:underline"
                    >
                      {seg.isImportant ? "取消重要" : "重要"}
                    </button>
                    <button
                      onClick={() =>
                        onUpdate({ ...seg, needsReview: !seg.needsReview })
                      }
                      className="text-rose-600 hover:underline"
                    >
                      {seg.needsReview ? "已確認" : "需確認"}
                    </button>
                  </>
                )}
              </span>
            </div>
            {editingId === seg.id ? (
              <div className="mt-2 space-y-2">
                <input
                  value={draftSpeaker}
                  onChange={(e) => setDraftSpeaker(e.target.value)}
                  className="input"
                />
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={3}
                  className="input"
                />
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                {seg.text}
              </p>
            )}
          </li>
        ))}
        {livePartial?.text && (
          <li className="rounded border border-emerald-200 bg-emerald-50 p-2">
            <div className="text-xs text-emerald-700">
              [{formatTime(livePartial.startTime)}] {livePartial.speakerLabel} ·
              即時轉錄中…
            </div>
            <p className="mt-1 whitespace-pre-wrap text-emerald-900">
              {livePartial.text}
            </p>
          </li>
        )}
      </ul>
    </div>
  );
}
