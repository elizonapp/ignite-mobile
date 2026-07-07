import { ApiError } from "../lib/api";
import { resolveApiError } from "./resolve-error";

/** Resolves a user-facing message from a caught API or unknown error. */
export function resolveCaughtApiError(
  err: unknown,
  t: (key: string) => string,
  fallbackKey = "unknownError",
): string {
  if (err instanceof ApiError) {
    return resolveApiError(err.payload, t, { fallbackKey });
  }
  return t(fallbackKey);
}
