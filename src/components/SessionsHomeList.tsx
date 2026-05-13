"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listSessions, deleteSession } from "@/lib/storage";
import type { OralDefenseSession } from "@/types/session";

export default function SessionsHomeList() {
  const [sessions, setSessions] = useState<OralDefenseSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await listSessions();
      setSessions(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((items) => {
        if (alive) setSessions(items);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此口試場次？此操作不可復原。")) return;
    await deleteSession(id);
    await refresh();
  }

  if (error) {
    return (
      <section className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        無法讀取本地紀錄：{error}
      </section>
    );
  }

  if (sessions === null) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        載入本地場次中…
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        尚未建立任何口試場次。點擊上方「建立新口試場次」開始。
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">本機已建立的口試場次</h2>
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium text-zinc-900">
                {s.thesisTitle || "（未填題目）"}
              </div>
              <div className="text-zinc-500">
                {s.studentName || "未填學生"} · {s.date || "未填日期"} ·{" "}
                {statusLabel(s.status)}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/sessions/${s.id}`}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100"
              >
                進入錄音
              </Link>
              <Link
                href={`/sessions/${s.id}/report`}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100"
              >
                查看報告
              </Link>
              <button
                onClick={() => handleDelete(s.id)}
                className="rounded border border-rose-200 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
              >
                刪除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function statusLabel(status: OralDefenseSession["status"]) {
  switch (status) {
    case "draft":
      return "草稿";
    case "recording":
      return "錄音中";
    case "completed":
      return "已完成";
    case "archived":
      return "已封存";
  }
}
