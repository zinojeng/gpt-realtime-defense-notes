"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/lib/api-client";
import { transcriptToMarkdown } from "@/lib/format";
import {
  getFinalReport,
  getSession,
  listSegments,
  listSummaries,
  newId,
  saveFinalReport,
} from "@/lib/storage";
import type {
  FinalReport,
  OralDefenseSession,
  StageSummary,
  TranscriptSegment,
} from "@/types/session";

export default function ReportClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<OralDefenseSession | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summaries, setSummaries] = useState<StageSummary[]>([]);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [reviewMarkdown, setReviewMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingReview, setGeneratingReview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSession(sessionId);
        if (!s) {
          setError("找不到此口試場次。");
          setLoading(false);
          return;
        }
        setSession(s);
        setSegments(await listSegments(sessionId));
        setSummaries(await listSummaries(sessionId));
        setReport((await getFinalReport(sessionId)) ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const fullTranscript = useMemo(() => transcriptToMarkdown(segments), [segments]);
  const stageSummariesText = useMemo(
    () =>
      summaries
        .map(
          (s, i) =>
            `### 階段 ${i + 1}（${s.startTime}s – ${s.endTime}s）\n${s.markdown}`,
        )
        .join("\n\n"),
    [summaries],
  );

  async function generateReport() {
    if (!session) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/summarize/final", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          session,
          stageSummaries: stageSummariesText,
          fullTranscript,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = (await res.json()) as { markdown: string };
      const newReport: FinalReport = {
        id: newId("rep"),
        sessionId,
        markdown: data.markdown,
        createdAt: new Date().toISOString(),
      };
      await saveFinalReport(newReport);
      setReport(newReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function generateReviewTerms() {
    if (!session) return;
    setError(null);
    setGeneratingReview(true);
    try {
      const res = await fetch("/api/review-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ transcript: fullTranscript }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = (await res.json()) as { markdown: string };
      setReviewMarkdown(data.markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingReview(false);
    }
  }

  function downloadFile(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <main className="p-6 text-sm text-zinc-500">載入中…</main>;
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-rose-700">
        {error ?? "找不到此口試場次。"}
        <div className="mt-4">
          <Link href="/" className="text-zinc-700 underline">
            返回首頁
          </Link>
        </div>
      </main>
    );
  }

  const exportBaseName = `oral-defense-${session.studentName || "session"}-${session.date || ""}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="space-y-1 border-b border-zinc-200 pb-3">
        <p className="text-xs text-zinc-500">最終紀錄（草稿，需人工確認）</p>
        <h1 className="text-2xl font-bold">{session.thesisTitle || "（未填題目）"}</h1>
        <p className="text-sm text-zinc-600">
          {session.studentName} · {session.date} ·{" "}
          {session.location ?? "未填地點"}
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/sessions/${sessionId}`}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100"
        >
          回到錄音頁
        </Link>
        <button
          onClick={generateReport}
          disabled={generating || (segments.length === 0 && summaries.length === 0)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {generating
            ? "產生中…"
            : report
              ? "重新產生最終紀錄"
              : "產生最終紀錄"}
        </button>
        <button
          onClick={generateReviewTerms}
          disabled={generatingReview || segments.length === 0}
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          {generatingReview ? "比對中…" : "找出需人工確認的詞彙"}
        </button>
        <button
          disabled={!report}
          onClick={() =>
            report &&
            navigator.clipboard.writeText(report.markdown).then(() => {
              alert("已複製至剪貼簿");
            })
          }
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
        >
          複製全文
        </button>
        <button
          disabled={!report}
          onClick={() =>
            report &&
            downloadFile(
              `${exportBaseName}.md`,
              report.markdown,
              "text/markdown;charset=utf-8",
            )
          }
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
        >
          下載 Markdown
        </button>
        <button
          disabled={!report}
          onClick={() =>
            report &&
            downloadFile(
              `${exportBaseName}.txt`,
              report.markdown,
              "text/plain;charset=utf-8",
            )
          }
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
        >
          下載 TXT
        </button>
        <button
          onClick={() =>
            downloadFile(
              `${exportBaseName}-transcript.md`,
              fullTranscript,
              "text/markdown;charset=utf-8",
            )
          }
          disabled={segments.length === 0}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60"
        >
          下載完整逐字稿
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">最終紀錄草稿</h2>
          <div className="min-h-[60vh] rounded-md border border-zinc-200 bg-white p-4 text-sm">
            {report ? (
              <pre className="whitespace-pre-wrap break-words text-zinc-800">
                {report.markdown}
              </pre>
            ) : (
              <p className="text-zinc-400">
                尚未產生。按下「產生最終紀錄」開始。
              </p>
            )}
          </div>
        </article>

        <article className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">
            需人工確認 / 階段摘要
          </h2>
          <div className="min-h-[60vh] space-y-4 rounded-md border border-zinc-200 bg-white p-4 text-sm">
            {reviewMarkdown && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  需人工確認詞彙
                </h3>
                <pre className="whitespace-pre-wrap break-words text-zinc-800">
                  {reviewMarkdown}
                </pre>
              </div>
            )}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                所有階段摘要
              </h3>
              {summaries.length === 0 ? (
                <p className="text-zinc-400">尚無階段摘要。</p>
              ) : (
                <ul className="space-y-3">
                  {summaries.map((s, i) => (
                    <li
                      key={s.id}
                      className="rounded border border-zinc-100 p-2 text-xs"
                    >
                      <div className="mb-1 font-medium text-zinc-500">
                        階段 {i + 1}（{s.startTime}s – {s.endTime}s）
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-zinc-800">
                        {s.markdown}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </article>
      </section>

      <p className="text-xs text-zinc-500">
        重要提醒：本紀錄由 AI 產生，僅作為草稿。請與口試錄音 /
        記錄者筆記交叉確認，並由主席或紀錄人簽署後才作為正式紀錄。
      </p>
    </main>
  );
}
