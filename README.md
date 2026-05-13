# 論文口試 AI 紀錄助理 · Oral Defense AI Recorder

一個 Next.js 應用，用於論文口試現場：

- 透過 OpenAI **Realtime Transcription API** 即時將現場語音轉為逐字稿
- 記錄者手動切換目前講者（主席 / 委員 / 學生 / 指導教授…）
- 每 5 分鐘自動產生階段摘要（委員意見、學生回覆、修改建議、決議、待辦事項）
- 口試結束後產生「最終口試紀錄草稿」，可匯出 Markdown / TXT
- 額外列出可能需要人工確認的人名、專有名詞、統計方法
- 同時於前端背景錄一份備援 webm 音檔，避免網路中斷遺失原始錄音

> 所有 AI 產出皆為**草稿**。請務必由主席或紀錄人交叉比對後才能作為正式紀錄。

詳細需求與系統設計請見 [`oral_defense_ai_recorder_sdd.md`](../oral_defense_ai_recorder_sdd.md)（上層目錄）。

---

## 1. 技術棧

- Next.js 16（App Router）+ React 19
- TypeScript + Tailwind CSS v4
- OpenAI Realtime Transcription（WebRTC，瀏覽器直連）
- OpenAI Chat Completions（階段摘要 / 最終紀錄 / 需確認詞彙）
- 前端 IndexedDB 儲存所有場次資料（不需資料庫）

---

## 2. 在本機跑起來

```bash
cd oral-defense-ai-recorder
cp .env.example .env.local
# 編輯 .env.local，填入 OPENAI_API_KEY
npm install
npm run dev
# 開啟 http://localhost:3000
```

### 必要 / 可選環境變數

| 變數                           | 必填 | 預設                  | 說明                                            |
| ------------------------------ | ---- | --------------------- | ----------------------------------------------- |
| `OPENAI_API_KEY`               | ✅   | —                     | 後端使用，不會暴露給前端                        |
| `OPENAI_TRANSCRIPTION_MODEL`   |      | `gpt-4o-transcribe`   | Realtime 轉錄模型，可換 `gpt-realtime-whisper`  |
| `OPENAI_SUMMARY_MODEL`         |      | `gpt-4o-mini`         | 階段摘要 / 最終紀錄使用的模型                   |
| `SUMMARY_INTERVAL_MS`          |      | `300000`              | 自動階段摘要的間隔（毫秒），由 `/api/config` 在執行時提供 |
| `APP_SHARED_SECRET`            | 🔒   | —                     | 公開部署強烈建議設定；前端會自動帶 `x-app-secret` 標頭 |

---

## 3. 部署到 Zeabur

> 本專案附帶 `Dockerfile`（multi-stage、Next.js standalone、`node:20-alpine`）。
> Zeabur 偵測到 Dockerfile 後會直接以 Docker 模式建置，**繞過 Zeabur 預設 Node builder**，
> 避免 `RUN npm update -g npm` 之類的 base image bug。

1. 把整個 repo push 到 GitHub。
2. 登入 [Zeabur](https://zeabur.com) → **Create Project** → **Deploy New Service** → 連結 GitHub repo。
3. Zeabur 會偵測到根目錄的 `Dockerfile` 並以 Docker 模式建置（不需要任何 `zbpack` 設定）。
4. 在 service 的 **Environment Variables** 設定：
   - `OPENAI_API_KEY=sk-...`
   - **強烈建議**：`APP_SHARED_SECRET=<自訂高熵字串>`，否則任何人都可以呼叫你的後端燒 OpenAI 額度。
   - 其他可選變數依需求加入（`OPENAI_SUMMARY_MODEL`、`SUMMARY_INTERVAL_MS` 等）。
5. 部署完成後，於 service 設定 **Domain** → Generate 一個 `*.zeabur.app` 網域或綁定自有網域。
6. 開啟網域，瀏覽器會要求麥克風權限——必須是 HTTPS 才允許 `getUserMedia`，Zeabur 預設就是 HTTPS。

### Zeabur 注意事項

- **port**：Dockerfile 預設 `PORT=8080`，但 Zeabur 會注入自己的 `PORT` 環境變數；standalone server 會自動採用 Zeabur 的值。
- **healthcheck**：Dockerfile 內建 `/api/config` 健康檢查。
- **無需資料庫**：所有場次紀錄存於使用者瀏覽器 IndexedDB；不同電腦 / 不同瀏覽器之間不會同步。
- **無持久化儲存**：伺服器端僅作為 OpenAI 的 proxy（ephemeral token + Chat Completions），不寫檔。
- **WebRTC 直連**：瀏覽器透過 OpenAI 回傳的 ephemeral key 直接連到 `api.openai.com`；Zeabur 本身只看到一次性 token 申請與 Chat Completions 呼叫，**不會代理音訊**，因此頻寬成本很低。
- **建議區域**：選 Tokyo / Singapore，降低台灣 ↔ OpenAI 的延遲。

### 本機 Docker 測試（可選）

```bash
docker build -t oral-defense .
docker run --rm -p 8080:8080 \
  -e OPENAI_API_KEY=sk-... \
  -e APP_SHARED_SECRET=hunter2 \
  oral-defense
# 開啟 http://localhost:8080
```

---

## 4. 現場操作建議

1. 口試前在「建立新口試場次」填好論文題目、學生姓名、委員、研究關鍵字——這些會作為 AI 的轉錄與摘要上下文。
2. 桌面中央放一支 USB 全向麥克風；另準備手機 / 錄音筆作為備援。
3. 開始錄音前提醒所有與會者「本場會議將以 AI 輔助紀錄」。
4. 發言時記錄者點選對應講者按鈕；忘記切換可在逐字稿區即時修改。
5. 中場休息或 5 分鐘自動觸發的階段摘要出現時，快速瀏覽即可。
6. 口試結束按下「停止錄音」後，到 `/sessions/[id]/report` 產生最終紀錄與「需人工確認」清單。
7. 匯出 Markdown 後，由人工修正人名 / 數字 / 決議再貼到學校紀錄。

---

## 5. 專案結構

```
src/
  app/
    api/
      realtime/token/route.ts         # 申請 OpenAI Realtime ephemeral key
      summarize/stage/route.ts        # 階段摘要 LLM
      summarize/final/route.ts        # 最終紀錄 LLM
      review-terms/route.ts           # 需確認詞彙 LLM
    sessions/
      new/page.tsx                    # 建立場次
      [id]/page.tsx + RecordingClient.tsx
      [id]/report/page.tsx + ReportClient.tsx
    layout.tsx / page.tsx / globals.css
  components/
    SessionsHomeList.tsx
    SpeakerButtons.tsx
    TranscriptPanel.tsx
    SummaryPanel.tsx
  lib/
    storage.ts                        # 瀏覽器 IndexedDB
    realtime.ts                       # WebRTC + Realtime transcription client
    openai-server.ts                  # 後端 Chat Completions wrapper
    prompts.ts                        # 系統 / 階段 / 最終 / 需確認 prompts
    format.ts                         # 時間戳 / Markdown 轉換
  types/session.ts
```

---

## 6. 隱私與安全

- `OPENAI_API_KEY` 永遠在 Server Side；Realtime 連線使用每場一次性的 ephemeral key。
- 場次資料只存在使用者瀏覽器，不會被伺服器收集。
- 備援錄音檔（webm）在使用者本機產生，需由使用者主動下載。
- 請依學校 / IRB 規範取得錄音同意。

---

## 7. License

MIT
