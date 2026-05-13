"use client";

import { useMemo } from "react";
import type { OralDefenseSession } from "@/types/session";

export interface SpeakerButtonsProps {
  session: OralDefenseSession;
  current: string;
  onChange: (label: string) => void;
  disabled?: boolean;
}

export default function SpeakerButtons({
  session,
  current,
  onChange,
  disabled,
}: SpeakerButtonsProps) {
  const labels = useMemo(() => {
    const base: string[] = [];
    if (session.chairName) base.push(`主席（${session.chairName}）`);
    else base.push("主席");
    (session.committeeMembers ?? []).forEach((m, i) => {
      base.push(m ? `委員 ${i + 1}（${m}）` : `委員 ${i + 1}`);
    });
    // Always include at least 3 committee slots even if not named
    while (base.filter((l) => l.startsWith("委員")).length < 3) {
      const next = base.filter((l) => l.startsWith("委員")).length + 1;
      base.push(`委員 ${next}`);
    }
    if (session.advisorName) base.push(`指導教授（${session.advisorName}）`);
    else base.push("指導教授");
    base.push(session.studentName ? `學生（${session.studentName}）` : "學生");
    base.push("其他");
    return base;
  }, [session]);

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => {
        const active = label === current;
        return (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(label)}
            className={
              "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 " +
              (active
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400")
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
