"use client";

import type {
  FinalReport,
  OralDefenseSession,
  SessionBundle,
  StageSummary,
  TranscriptSegment,
} from "@/types/session";

const DB_NAME = "oral-defense-ai-recorder";
const DB_VERSION = 1;

const STORE_SESSIONS = "sessions";
const STORE_SEGMENTS = "segments";
const STORE_SUMMARIES = "summaries";
const STORE_REPORTS = "reports";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable in this environment."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
        const store = db.createObjectStore(STORE_SEGMENTS, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SUMMARIES)) {
        const store = db.createObjectStore(STORE_SUMMARIES, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        const store = db.createObjectStore(STORE_REPORTS, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        let value: T;
        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
        Promise.resolve(fn(transaction))
          .then((v) => {
            value = v;
          })
          .catch((err) => {
            try {
              transaction.abort();
            } catch {
              /* noop */
            }
            reject(err);
          });
      }),
  );
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function newId(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return prefix ? `${prefix}_${rand}` : rand;
}

export async function saveSession(session: OralDefenseSession): Promise<void> {
  await tx(STORE_SESSIONS, "readwrite", async (t) => {
    await reqToPromise(t.objectStore(STORE_SESSIONS).put(session));
  });
}

export async function getSession(id: string): Promise<OralDefenseSession | undefined> {
  return tx(STORE_SESSIONS, "readonly", async (t) =>
    reqToPromise<OralDefenseSession | undefined>(
      t.objectStore(STORE_SESSIONS).get(id),
    ),
  );
}

export async function listSessions(): Promise<OralDefenseSession[]> {
  return tx(STORE_SESSIONS, "readonly", async (t) => {
    const all = await reqToPromise<OralDefenseSession[]>(
      t.objectStore(STORE_SESSIONS).getAll(),
    );
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export async function deleteSession(id: string): Promise<void> {
  await tx(
    [STORE_SESSIONS, STORE_SEGMENTS, STORE_SUMMARIES, STORE_REPORTS],
    "readwrite",
    async (t) => {
      await reqToPromise(t.objectStore(STORE_SESSIONS).delete(id));
      for (const store of [STORE_SEGMENTS, STORE_SUMMARIES, STORE_REPORTS]) {
        const idx = t.objectStore(store).index("sessionId");
        const keys = await reqToPromise<IDBValidKey[]>(idx.getAllKeys(id));
        for (const k of keys) {
          await reqToPromise(t.objectStore(store).delete(k as IDBValidKey));
        }
      }
    },
  );
}

export async function addSegment(segment: TranscriptSegment): Promise<void> {
  await tx(STORE_SEGMENTS, "readwrite", async (t) => {
    await reqToPromise(t.objectStore(STORE_SEGMENTS).put(segment));
  });
}

export async function updateSegment(
  segment: TranscriptSegment,
): Promise<void> {
  await tx(STORE_SEGMENTS, "readwrite", async (t) => {
    await reqToPromise(t.objectStore(STORE_SEGMENTS).put(segment));
  });
}

export async function listSegments(sessionId: string): Promise<TranscriptSegment[]> {
  return tx(STORE_SEGMENTS, "readonly", async (t) => {
    const idx = t.objectStore(STORE_SEGMENTS).index("sessionId");
    const items = await reqToPromise<TranscriptSegment[]>(idx.getAll(sessionId));
    return items.sort((a, b) => a.startTime - b.startTime);
  });
}

export async function addSummary(summary: StageSummary): Promise<void> {
  await tx(STORE_SUMMARIES, "readwrite", async (t) => {
    await reqToPromise(t.objectStore(STORE_SUMMARIES).put(summary));
  });
}

export async function listSummaries(sessionId: string): Promise<StageSummary[]> {
  return tx(STORE_SUMMARIES, "readonly", async (t) => {
    const idx = t.objectStore(STORE_SUMMARIES).index("sessionId");
    const items = await reqToPromise<StageSummary[]>(idx.getAll(sessionId));
    return items.sort((a, b) => a.startTime - b.startTime);
  });
}

export async function saveFinalReport(report: FinalReport): Promise<void> {
  await tx(STORE_REPORTS, "readwrite", async (t) => {
    await reqToPromise(t.objectStore(STORE_REPORTS).put(report));
  });
}

export async function getFinalReport(
  sessionId: string,
): Promise<FinalReport | undefined> {
  return tx(STORE_REPORTS, "readonly", async (t) => {
    const idx = t.objectStore(STORE_REPORTS).index("sessionId");
    const items = await reqToPromise<FinalReport[]>(idx.getAll(sessionId));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  });
}

export async function loadBundle(sessionId: string): Promise<SessionBundle | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  const [segments, summaries, finalReport] = await Promise.all([
    listSegments(sessionId),
    listSummaries(sessionId),
    getFinalReport(sessionId),
  ]);
  return { session, segments, summaries, finalReport };
}
