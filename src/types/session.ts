export type SessionStatus = "draft" | "recording" | "completed" | "archived";

export interface OralDefenseSession {
  id: string;
  thesisTitle: string;
  studentName: string;
  advisorName?: string;
  chairName?: string;
  committeeMembers: string[];
  date: string;
  location?: string;
  researchKeywords: string[];
  language: "zh-TW" | "en" | "mixed";
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speakerLabel: string;
  startTime: number;
  endTime?: number;
  text: string;
  rawText?: string;
  isEdited: boolean;
  isImportant: boolean;
  needsReview: boolean;
  createdAt: string;
}

export interface StageSummary {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  markdown: string;
  createdAt: string;
}

export interface FinalReport {
  id: string;
  sessionId: string;
  markdown: string;
  createdAt: string;
}

export interface SessionBundle {
  session: OralDefenseSession;
  segments: TranscriptSegment[];
  summaries: StageSummary[];
  finalReport?: FinalReport;
}

export const DEFAULT_SPEAKER_LABELS = [
  "主席",
  "委員 A",
  "委員 B",
  "委員 C",
  "指導教授",
  "學生",
  "其他",
] as const;

export type DefaultSpeakerLabel = (typeof DEFAULT_SPEAKER_LABELS)[number];
