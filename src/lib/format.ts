import type { TranscriptSegment } from "@/types/session";

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

export function transcriptToMarkdown(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      const flags: string[] = [];
      if (seg.isImportant) flags.push("★");
      if (seg.needsReview) flags.push("⚠ 需確認");
      const suffix = flags.length ? ` [${flags.join(" ")}]` : "";
      return `[${formatTime(seg.startTime)}] [${seg.speakerLabel}] ${seg.text}${suffix}`;
    })
    .join("\n");
}
