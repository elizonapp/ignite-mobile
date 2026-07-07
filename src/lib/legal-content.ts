import { getApiBaseUrl } from "./config";

export const AUTH_LEGAL_PAGES = [
  { slug: "imprint", labelKey: "footerImprint" },
  { slug: "privacy", labelKey: "footerPrivacy" },
  { slug: "terms", labelKey: "footerTerms" },
  { slug: "withdrawal", labelKey: "footerWithdrawal" },
  { slug: "fair-use", labelKey: "footerFairUse" },
  { slug: "payment", labelKey: "footerPayment" },
] as const;

export type LegalSlug = (typeof AUTH_LEGAL_PAGES)[number]["slug"];

export function getLegalMarkdownUrl(slug: LegalSlug, lang: "de" | "en"): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const locale = lang === "de" ? "de" : "en";
  return `${base}/legal/${slug}/${locale}.md`;
}

export async function fetchLegalMarkdown(slug: LegalSlug, lang: "de" | "en"): Promise<string> {
  const response = await fetch(getLegalMarkdownUrl(slug, lang), {
    headers: { Accept: "text/markdown, text/plain, */*" },
  });
  if (!response.ok) {
    throw new Error(`legal_fetch_failed:${response.status}`);
  }
  return response.text();
}
