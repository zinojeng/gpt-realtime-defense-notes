"use client";

import { useEffect, useState } from "react";
import { getRuntimeConfig, getSharedSecret, setSharedSecret } from "@/lib/api-client";

export default function SecretGate() {
  const [required, setRequired] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string>("");

  useEffect(() => {
    let alive = true;
    getRuntimeConfig()
      .then((cfg) => {
        if (alive) {
          setRequired(cfg.sharedSecretRequired);
          setSaved(getSharedSecret());
        }
      })
      .catch(() => {
        if (alive) {
          setRequired(false);
          setSaved(getSharedSecret());
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (required === null || required === false) return null;

  return (
    <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <h2 className="mb-1 font-semibold">需要共用密碼</h2>
      <p className="mb-3 text-emerald-800">
        此部署啟用了 <code>APP_SHARED_SECRET</code>。請輸入密碼，所有 API
        呼叫會自動帶上 <code>x-app-secret</code> 標頭。密碼僅存於本機
        localStorage。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input max-w-xs"
          placeholder={saved ? "已設定 — 輸入新密碼以覆蓋" : "輸入密碼…"}
        />
        <button
          onClick={() => {
            setSharedSecret(value);
            setValue("");
            setSaved(value);
          }}
          className="rounded bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-600"
        >
          儲存
        </button>
        {saved && (
          <button
            onClick={() => {
              setSharedSecret("");
              setSaved("");
            }}
            className="rounded border border-emerald-300 px-3 py-2 text-emerald-800 hover:bg-emerald-100"
          >
            清除
          </button>
        )}
        <span className="text-xs text-emerald-700">
          目前狀態：{saved ? "已儲存" : "尚未設定"}
        </span>
      </div>
    </section>
  );
}
