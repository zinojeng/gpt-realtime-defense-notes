"use client";

let cachedSecret: string | null = null;

export function getSharedSecret(): string {
  if (typeof window === "undefined") return "";
  if (cachedSecret !== null) return cachedSecret;
  try {
    cachedSecret = window.localStorage.getItem("app-shared-secret") ?? "";
  } catch {
    cachedSecret = "";
  }
  return cachedSecret;
}

export function setSharedSecret(value: string): void {
  cachedSecret = value;
  try {
    if (value) window.localStorage.setItem("app-shared-secret", value);
    else window.localStorage.removeItem("app-shared-secret");
  } catch {
    /* noop */
  }
}

export function authHeaders(): Record<string, string> {
  const secret = getSharedSecret();
  return secret ? { "x-app-secret": secret } : {};
}

export interface RuntimeConfig {
  summaryIntervalMs: number;
  sharedSecretRequired: boolean;
}

let cachedConfig: Promise<RuntimeConfig> | null = null;

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cachedConfig) {
    cachedConfig = fetch("/api/config", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`config fetch failed: ${r.status}`);
        return r.json() as Promise<RuntimeConfig>;
      })
      .catch(() => ({ summaryIntervalMs: 5 * 60 * 1000, sharedSecretRequired: false }));
  }
  return cachedConfig;
}
