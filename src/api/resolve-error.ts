import { ALL_API_ERROR_CODES, type ApiErrorCode } from "./error-codes.generated";
import { LEGACY_TEXT_TO_CODE } from "./legacy-text-to-code.generated";

const KNOWN_CODES = new Set<string>(ALL_API_ERROR_CODES);

export type ResolveApiErrorOptions = {
  audience?: "user" | "admin";
  fallbackKey?: string;
  /** Literal fallback text used when no code can be resolved (transitional). */
  fallbackText?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Maps errorCode camelCase → i18n key (apiError + PascalCase). */
export function errorCodeToI18nKey(code: string): string {
  if (!code) return "apiErrorUnknown";
  return `apiError${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

export function interpolateApiError(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function resolveCodeFromLegacyFields(record: Record<string, unknown>): string | null {
  if (typeof record.errorCode === "string" && record.errorCode.trim()) {
    return record.errorCode.trim();
  }

  if (typeof record.errorKey === "string" && record.errorKey.trim()) {
    const key = record.errorKey.trim();
    return LEGACY_TEXT_TO_CODE[key] ?? key;
  }

  if (typeof record.messageKey === "string" && record.messageKey.trim()) {
    const key = record.messageKey.trim();
    return LEGACY_TEXT_TO_CODE[key] ?? key;
  }

  const textCandidates = [record.error, record.message, record.errorMessage].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );

  for (const text of textCandidates) {
    const trimmed = text.trim();
    if (trimmed === "unauthenticated") return "unauthenticated";
    const fromMap = LEGACY_TEXT_TO_CODE[trimmed];
    if (fromMap) return fromMap;
    if (KNOWN_CODES.has(trimmed)) return trimmed;
  }

  return null;
}

/**
 * Resolves a localized user-facing message from an API error payload.
 * Supports legacy `error`/`errorKey` fields during migration.
 */
export function resolveApiError(
  data: unknown,
  t: (key: string) => string,
  options?: ResolveApiErrorOptions
): string {
  const fallbackKey = options?.fallbackKey ?? "apiErrorUnknown";
  const fallback = () => options?.fallbackText ?? t(fallbackKey);

  if (!isRecord(data)) {
    return fallback();
  }

  const code = resolveCodeFromLegacyFields(data);
  if (!code) {
    return fallback();
  }

  const i18nKey = errorCodeToI18nKey(code);
  const params = isRecord(data.errorParams)
    ? (data.errorParams as Record<string, string | number>)
    : undefined;

  const translated = t(i18nKey);
  if (translated !== i18nKey) {
    return interpolateApiError(translated, params);
  }

  // Flat key fallback (some routes used bare keys before apiError prefix)
  const flat = t(code);
  if (flat !== code) {
    return interpolateApiError(flat, params);
  }

  return fallback();
}

export function getApiErrorCode(data: unknown): ApiErrorCode | null {
  if (!isRecord(data)) return null;
  const code = resolveCodeFromLegacyFields(data);
  if (!code || !KNOWN_CODES.has(code)) return null;
  return code as ApiErrorCode;
}
