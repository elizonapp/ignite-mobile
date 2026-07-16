import { ApiError } from "../lib/api";
import { resolveApiError } from "./resolve-error";

/** Resolves a user-facing message from a caught API or unknown error. */
export function resolveCaughtApiError(
  err: unknown,
  // Compatible with Dict-keyed `t` from useI18n (parameter is contravariant).
  t: (key: never) => string,
  fallbackKey = "unknownError",
): string {
  const translate = t as (key: string) => string;
  if (err instanceof ApiError) {
    return resolveApiError(err.payload, t, { fallbackKey });
  }
  return translate(fallbackKey);
}
