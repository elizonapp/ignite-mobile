import { de } from "./de";
import { en } from "./en";

/** Resolves i18n keys outside React (hooks, API layer). */
export function mobileTranslate(key: string): string {
  if (typeof window === "undefined") return de[key as keyof typeof de] ?? key;
  const lang = window.localStorage.getItem("elizon.lang");
  const dict = lang === "en" ? en : de;
  return dict[key as keyof typeof dict] ?? en[key as keyof typeof en] ?? key;
}
