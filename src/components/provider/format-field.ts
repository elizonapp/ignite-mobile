import type { ResolvedField } from "./types";

type FieldLike = Pick<ResolvedField, "format" | "value" | "formatted">;

/**
 * Display string for a resolved field. The view endpoint already ships a
 * localized `formatted` string per field, so — unlike the storefront
 * configurator — the read-only mobile detail simply reuses it and only falls
 * back to the raw value when `formatted` is empty.
 */
export function formatResolvedFieldValue(
  field: FieldLike,
  t?: (key: string) => string,
): string | null {
  const formatted = field.formatted?.trim();
  if (formatted) return formatted;

  const { value, format } = field;
  if (value === undefined || value === null) return null;

  if (format === "boolean") {
    const bool = value === true || value === "true";
    if (t) return bool ? t("yes") : t("no");
    return String(bool);
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/** Whether a resolved field has a user-visible value. */
export function hasResolvedFieldDisplayValue(field: FieldLike): boolean {
  if (field.format === "boolean") {
    return field.value !== undefined && field.value !== null;
  }
  return formatResolvedFieldValue(field) !== null;
}
