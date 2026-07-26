/** Hardcoded production API origin — not user-configurable. */
export const API_BASE_URL = "https://www.elizon.app";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/** Baked at build time via build.ts (semver + git sha, e.g. "0.8.2 (ba3559d)"). */
export const APP_VERSION = process.env.APP_VERSION ?? "0.0.0-dev";
