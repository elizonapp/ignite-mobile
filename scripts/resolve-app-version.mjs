// Standalone copy of lib/app-version.mjs for ignite-mobile mirror builds — keep in sync.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")
);

export function normalizeAppVersion(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim().replace(/^v/i, "");
  if (!trimmed || /x/i.test(trimmed)) return "";
  return trimmed;
}

export function resolveBuildSha() {
  const fromEnv = (
    process.env.NEXT_PUBLIC_BUILD_SHA ||
    process.env.BUILD_SHA ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT ||
    ""
  ).trim();

  if (fromEnv) {
    return fromEnv.replace(/^v/i, "").slice(0, 7);
  }

  try {
    return execSync("git rev-parse --short=7 HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function resolveAppSemver() {
  const fromEnv =
    normalizeAppVersion(process.env.APP_VERSION) ||
    normalizeAppVersion(process.env.NEXT_PUBLIC_VERSION);
  if (fromEnv) return fromEnv;

  const fromPkg = normalizeAppVersion(pkg.version);
  if (fromPkg) return fromPkg;

  return "0.0.0";
}

export function resolveAppVersion() {
  const semver = resolveAppSemver();
  const sha = resolveBuildSha();
  return sha ? `${semver} (${sha})` : semver;
}
