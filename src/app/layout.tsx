import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "論文口試 AI 紀錄助理",
  description:
    "現場即時逐字稿、AI 階段摘要、最終口試紀錄草稿匯出。所有 AI 產出為草稿，需人工確認後才能作為正式紀錄。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
