import Link from "next/link";
import SecretGate from "@/components/SecretGate";
import SessionsHomeList from "@/components/SessionsHomeList";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium text-emerald-700">
          MVP · 所有 AI 產出皆為草稿，需人工確認後才能作為正式紀錄
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          論文口試 AI 紀錄助理
        </h1>
        <p className="max-w-2xl text-zinc-600">
          口試現場即時逐字稿、講者手動切換、每 5
          分鐘自動階段摘要，並於口試結束後產生「委員意見 / 學生回覆 / 修改建議 /
          結論 / 待辦事項」正式紀錄草稿。
        </p>
      </header>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/sessions/new"
          className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-zinc-700"
        >
          建立新口試場次
        </Link>
        <a
          href="https://platform.openai.com/docs/guides/realtime-transcription"
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Realtime Transcription 文件
        </a>
      </section>

      <SecretGate />

      <SessionsHomeList />

      <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="font-semibold">現場操作提醒</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>請於口試前向所有與會者說明：本場會議將使用 AI 輔助紀錄。</li>
          <li>建議搭配手機或錄音筆全程備援錄音，避免網路中斷造成資料遺失。</li>
          <li>逐字稿中的人名、決議、數字、統計方法請於匯出前人工確認。</li>
          <li>本工具不會自動判斷論文是否通過，亦不能取代正式行政紀錄。</li>
        </ul>
      </section>
    </main>
  );
}
