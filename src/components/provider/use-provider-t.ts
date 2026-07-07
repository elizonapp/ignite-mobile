import { useI18n } from "../../i18n";

/**
 * Provider schemas carry dynamic i18n keys (tab/action/field labels) that are
 * plain strings, not members of the typed `Dict`. This wraps the typed `t` so
 * those keys can be resolved; the underlying implementation already falls back
 * to the raw key when a translation is missing.
 */
export function useProviderT(): (key: string) => string {
  const { t } = useI18n();
  return t as unknown as (key: string) => string;
}
