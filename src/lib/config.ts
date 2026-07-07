import pkg from "../../package.json" with { type: "json" };

const STORAGE_KEY = "elizon.apiBaseUrl";

const DEFAULT_BASE_URL = "https://www.elizon.app";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value && value.trim() ? value.trim() : null;
}

export function getApiBaseUrl(): string {
  return readStored() ?? DEFAULT_BASE_URL;
}

export function setApiBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "").trim();
  if (!trimmed) throw new Error("API base URL cannot be empty");
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  }
  return trimmed;
}

export function clearApiBaseUrl(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeVersion(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  return raw.trim().replace(/^v/i, "");
}

/** Release version: APP_VERSION (.env) overrides mobile/ignite/package.json. */
export const APP_VERSION =
  normalizeVersion(process.env.APP_VERSION) ||
  normalizeVersion(pkg.version) ||
  "0.0.0";
