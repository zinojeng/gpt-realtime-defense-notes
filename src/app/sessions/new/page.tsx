"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { newId, saveSession } from "@/lib/storage";
import type { OralDefenseSession } from "@/types/session";

export default function NewSessionPage() {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [thesisTitle, setThesisTitle] = useState("");
  const [studentName, setStudentName] = useState("");
  const [advisorName, setAdvisorName] = useState("");
  const [chairName, setChairName] = useState("");
  const [committeeMembersText, setCommitteeMembersText] = useState("");
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const session: OralDefenseSession = {
        id: newId("sess"),
        thesisTitle: thesisTitle.trim(),
        studentName: studentName.trim(),
        advisorName: advisorName.trim() || undefined,
        chairName: chairName.trim() || undefined,
        committeeMembers: splitList(committeeMembersText),
        date,
        location: location.trim() || undefined,
        researchKeywords: splitList(keywordsText),
        language: "zh-TW",
        createdAt: now,
        updatedAt: now,
        status: "draft",
      };
      await saveSession(session);
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">建立新口試場次</h1>
        <p className="text-sm text-zinc-600">
          以下資訊會作為 AI
          的上下文，協助辨識人名、研究題目與專有名詞。所有資料僅儲存在此瀏覽器
          (IndexedDB)，不會上傳到後端。
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="論文題目" required>
          <input
            value={thesisTitle}
            onChange={(e) => setThesisTitle(e.target.value)}
            required
            className="input"
            placeholder="例：以連續血糖監測探討第二型糖尿病的時間血糖變異"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="學生姓名" required>
            <input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="日期" required>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="指導教授">
            <input
              value={advisorName}
              onChange={(e) => setAdvisorName(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="主席">
            <input
              value={chairName}
              onChange={(e) => setChairName(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="口試委員（每行一位，或以逗號 / 頓號分隔）">
          <textarea
            value={committeeMembersText}
            onChange={(e) => setCommitteeMembersText(e.target.value)}
            rows={3}
            className="input"
            placeholder={"王教授\n李教授\n陳教授"}
          />
        </Field>

        <Field label="地點">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input"
            placeholder="例：醫學院第三會議室"
          />
        </Field>

        <Field label="研究關鍵字 / 重要專有名詞（每行一個，或逗號分隔）">
          <textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={4}
            className="input"
            placeholder={"HbA1c\nCGM\nmixed model\nprimary outcome"}
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {submitting ? "建立中…" : "建立場次並進入錄音頁"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-100"
          >
            取消
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-zinc-800">
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function splitList(s: string): string[] {
  return s
    .split(/[\n,、，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
