"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SpeakerButtons from "@/components/SpeakerButtons";
import TranscriptPanel from "@/components/TranscriptPanel";
import SummaryPanel from "@/components/SummaryPanel";
import { authHeaders, getRuntimeConfig } from "@/lib/api-client";
import { formatTime, transcriptToMarkdown } from "@/lib/format";
import { sessionContext } from "@/lib/prompts";
import { RealtimeTranscriber } from "@/lib/realtime";
import {
  addSegment,
  addSummary,
  getSession,
  listSegments,
  listSummaries,
  newId,
  saveSession,
  updateSegment,
} from "@/lib/storage";
import type {
  OralDefenseSession,
  StageSummary,
  TranscriptSegment,
} from "@/types/session";

interface PartialItem {
  text: string;
  startTime: number;
  speakerLabel: string;
}

export default function RecordingClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<OralDefenseSession | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summaries, setSummaries] = useState<StageSummary[]>([]);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState("主席");
  const [livePartials, setLivePartials] = useState<Map<string, PartialItem>>(
    new Map(),
  );
  const [summarizing, setSummarizing] = useState(false);
  const [recorderUrl, setRecorderUrl] = useState<string | null>(null);

  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const speakerRef = useRef(currentSpeaker);
  const partialMetaRef = useRef<Map<string, { startTime: number; speakerLabel: string }>>(
    new Map(),
  );
  const lastSummaryUntilRef = useRef(0);
  const summaryIntervalMsRef = useRef(5 * 60 * 1000);
  const summarizingRef = useRef(false);
  const summarizeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const backupStreamRef = useRef<MediaStream | null>(null);
  const recorderUrlRef = useRef<string | null>(null);

  useEffect(() => {
    speakerRef.current = currentSpeaker;
  }, [currentSpeaker]);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getRuntimeConfig();
        summaryIntervalMsRef.current = cfg.summaryIntervalMs;
      } catch {
        /* keep default */
      }
      try {
        const s = await getSession(sessionId);
        if (!s) {
          setError("找不到此口試場次。請從首頁重新建立。");
          return;
        }
        setSession(s);
        const segs = await listSegments(sessionId);
        setSegments(segs);
        const sums = await listSummaries(sessionId);
        setSummaries(sums);
        // Resume summary cursor from latest saved summary, so a page reload
        // doesn't cause already-summarized transcript to be re-summarized.
        lastSummaryUntilRef.current = sums.length
          ? sums[sums.length - 1]!.endTime
          : 0;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    return () => {
      transcriberRef.current?.stop();
      if (summarizeTimerRef.current) clearInterval(summarizeTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      stopBackupRecorder();
      if (recorderUrlRef.current) URL.revokeObjectURL(recorderUrlRef.current);
    };
  }, []);

  const elapsedSeconds = useCallback(() => {
    if (!startedAtRef.current) return 0;
    return Math.floor((Date.now() - startedAtRef.current) / 1000);
  }, []);

  async function start() {
    if (!session) return;
    setError(null);
    try {
      const backupStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      backupStreamRef.current = backupStream;
      const mimeType = pickRecorderMime();
      try {
        const rec = new MediaRecorder(
          backupStream,
          mimeType ? { mimeType } : undefined,
        );
        recordedChunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, {
            type: rec.mimeType || "audio/webm",
          });
          const url = URL.createObjectURL(blob);
          if (recorderUrlRef.current) URL.revokeObjectURL(recorderUrlRef.current);
          recorderUrlRef.current = url;
          setRecorderUrl(url);
          // Trigger an immediate auto-download so the file survives navigation
          // away from the page. The user can also re-download from the player.
          const a = document.createElement("a");
          a.href = url;
          a.download = `oral-defense-${sessionId}-${new Date()
            .toISOString()
            .slice(0, 16)
            .replace(/[:T]/g, "-")}.webm`;
          a.click();
        };
        rec.start(2000);
        mediaRecorderRef.current = rec;
      } catch (err) {
        console.warn("MediaRecorder unavailable", err);
      }

      const transcriber = new RealtimeTranscriber({
        onStatus: setStatus,
        onError: (e) => setError(e.message),
        onPartialStart: (itemId) => {
          // Lock-in current speaker + start time the moment we first hear
          // this utterance, so switching speakers mid-utterance doesn't
          // mislabel the previous one.
          partialMetaRef.current.set(itemId, {
            startTime: elapsedSeconds(),
            speakerLabel: speakerRef.current,
          });
        },
        onPartial: (text, itemId) => {
          const meta = partialMetaRef.current.get(itemId);
          if (!meta) return;
          setLivePartials((prev) => {
            const next = new Map(prev);
            next.set(itemId, {
              text,
              startTime: meta.startTime,
              speakerLabel: meta.speakerLabel,
            });
            return next;
          });
        },
        onFinal: async (text, itemId) => {
          const meta = partialMetaRef.current.get(itemId) ?? {
            startTime: elapsedSeconds(),
            speakerLabel: speakerRef.current,
          };
          partialMetaRef.current.delete(itemId);
          setLivePartials((prev) => {
            const next = new Map(prev);
            next.delete(itemId);
            return next;
          });
          if (!text.trim()) return;
          const endTime = elapsedSeconds();
          const seg: TranscriptSegment = {
            id: newId("seg"),
            sessionId,
            speakerLabel: meta.speakerLabel,
            startTime: meta.startTime,
            endTime,
            text: text.trim(),
            rawText: text,
            isEdited: false,
            isImportant: false,
            needsReview: false,
            createdAt: new Date().toISOString(),
          };
          await addSegment(seg);
          setSegments((prev) => [...prev, seg]);
        },
      });
      transcriberRef.current = transcriber;

      const prompt = buildTranscriptionPrompt(session);
      await transcriber.start({ prompt });

      startedAtRef.current = Date.now();
      setRecording(true);
      setStatus("recording");
      const updated: OralDefenseSession = {
        ...session,
        status: "recording",
        updatedAt: new Date().toISOString(),
      };
      await saveSession(updated);
      setSession(updated);

      tickTimerRef.current = setInterval(() => {
        setElapsed(elapsedSeconds());
      }, 1000);

      summarizeTimerRef.current = setInterval(() => {
        void runStageSummary({ auto: true });
      }, summaryIntervalMsRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRecording(false);
      transcriberRef.current?.stop();
      transcriberRef.current = null;
      stopBackupRecorder();
    }
  }

  async function stop() {
    transcriberRef.current?.stop();
    transcriberRef.current = null;
    if (summarizeTimerRef.current) clearInterval(summarizeTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    summarizeTimerRef.current = null;
    tickTimerRef.current = null;
    stopBackupRecorder();
    setRecording(false);
    setStatus("stopped");
    if (session) {
      const updated: OralDefenseSession = {
        ...session,
        status: "completed",
        updatedAt: new Date().toISOString(),
      };
      await saveSession(updated);
      setSession(updated);
    }
  }

  function stopBackupRecorder() {
    try {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch {
      /* noop */
    }
    try {
      backupStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    mediaRecorderRef.current = null;
    backupStreamRef.current = null;
  }

  async function handleSegmentUpdate(seg: TranscriptSegment) {
    await updateSegment(seg);
    setSegments((prev) => prev.map((s) => (s.id === seg.id ? seg : s)));
  }

  async function runStageSummary({ auto }: { auto: boolean }) {
    if (!session) return;
    if (summarizingRef.current) return;
    summarizingRef.current = true;
    setSummarizing(true);
    setError(null);
    try {
      const all = await listSegments(sessionId);
      const sinceTime = lastSummaryUntilRef.current;
      const newSegs = all.filter((s) => s.startTime >= sinceTime);
      if (newSegs.length === 0) {
        if (!auto) setError("沒有新逐字稿可摘要。");
        return;
      }
      const chunk = transcriptToMarkdown(newSegs);
      const res = await fetch("/api/summarize/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ session, transcriptChunk: chunk }),
      });
      if (!res.ok)
        throw new Error(`摘要 API 失敗：${res.status} ${await res.text()}`);
      const data = (await res.json()) as { markdown: string };
      const startTime = newSegs[0]!.startTime;
      const endTime = newSegs[newSegs.length - 1]!.endTime ?? elapsedSeconds();
      const summary: StageSummary = {
        id: newId("sum"),
        sessionId,
        startTime,
        endTime,
        markdown: data.markdown,
        createdAt: new Date().toISOString(),
      };
      await addSummary(summary);
      setSummaries((prev) => [...prev, summary]);
      lastSummaryUntilRef.current = endTime;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      summarizingRef.current = false;
      setSummarizing(false);
    }
  }

  if (error && !session) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-sm text-rose-700">
        {error}
        <div className="mt-4">
          <Link href="/" className="text-zinc-700 underline">
            返回首頁
          </Link>
        </div>
      </main>
    );
  }
  if (!session) {
    return <main className="p-6 text-sm text-zinc-500">載入中…</main>;
  }

  const livePartialsList = Array.from(livePartials.entries())
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => a.startTime - b.startTime);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <p className="text-xs text-zinc-500">
            錄音狀態：{status} · 已錄音 {formatTime(elapsed)}
          </p>
          <h1 className="text-xl font-bold">{session.thesisTitle || "（未填題目）"}</h1>
          <p className="text-sm text-zinc-600">
            {session.studentName} · {session.date} ·{" "}
            {(session.committeeMembers ?? []).join("、") || "未填委員"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <button
              onClick={start}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              開始錄音
            </button>
          ) : (
            <button
              onClick={stop}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              停止錄音
            </button>
          )}
          <button
            onClick={() => runStageSummary({ auto: false })}
            disabled={summarizing}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
          >
            {summarizing ? "摘要中…" : "立即產生階段摘要"}
          </button>
          <Link
            href={`/sessions/${sessionId}/report`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            前往最終紀錄
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-700">目前講者</h2>
        <SpeakerButtons
          session={session}
          current={currentSpeaker}
          onChange={setCurrentSpeaker}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">即時逐字稿</h2>
          <TranscriptPanel
            segments={segments}
            livePartial={
              livePartialsList[0]
                ? {
                    speakerLabel: livePartialsList[0].speakerLabel,
                    text: livePartialsList.map((p) => p.text).join("　"),
                    startTime: livePartialsList[0].startTime,
                  }
                : undefined
            }
            onUpdate={handleSegmentUpdate}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">階段摘要</h2>
          <SummaryPanel summaries={summaries} pending={summarizing} />
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-zinc-800">備援錄音：</span>
          {recorderUrl ? (
            <>
              <audio controls src={recorderUrl} className="h-8" />
              <a
                href={recorderUrl}
                download={`oral-defense-${sessionId}.webm`}
                className="text-emerald-700 underline"
              >
                重新下載備援錄音檔
              </a>
            </>
          ) : recording ? (
            <span>正在於背景錄音中…</span>
          ) : (
            <span>停止錄音後，會自動下載備援音檔。</span>
          )}
          <span className="ml-auto text-zinc-500">
            上下文 prompt：{sessionContext(session).split("\n")[0]}
          </span>
        </div>
      </section>
    </main>
  );
}

function buildTranscriptionPrompt(session: OralDefenseSession): string {
  const lines: string[] = [
    "本錄音為大學論文口試會議，請以繁體中文輸出。",
    `論文題目：${session.thesisTitle || "未填"}`,
    `學生：${session.studentName || "未填"}`,
  ];
  if (session.advisorName) lines.push(`指導教授：${session.advisorName}`);
  if (session.chairName) lines.push(`主席：${session.chairName}`);
  if (session.committeeMembers?.length)
    lines.push(`口試委員：${session.committeeMembers.join("、")}`);
  if (session.researchKeywords?.length)
    lines.push(`重要專有名詞：${session.researchKeywords.join("、")}`);
  return lines.join("\n");
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}
