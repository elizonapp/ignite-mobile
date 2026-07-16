import { getApiBaseUrl } from "./config";

/** Alle einbettbaren Rechtsseiten (Markdown unter /legal/{slug}/{locale}.md). */
export const LEGAL_PAGES = [
  { slug: "terms", labelKey: "footerTerms" },
  { slug: "privacy", labelKey: "footerPrivacy" },
  { slug: "dpa", labelKey: "footerDpa", businessOnly: true },
  { slug: "imprint", labelKey: "footerImprint" },
  { slug: "withdrawal", labelKey: "footerWithdrawal" },
  { slug: "fair-use", labelKey: "footerFairUse" },
  { slug: "payment", labelKey: "footerPayment" },
  { slug: "tom", labelKey: "footerTom" },
  { slug: "tco", labelKey: "footerTco" },
  { slug: "for-parents", labelKey: "footerParents" },
  { slug: "dsa-contact-point", labelKey: "footerDsaContactPoint" },
] as const;

export type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"];
export type LegalPage = (typeof LEGAL_PAGES)[number];
export type LegalLabelKey = LegalPage["labelKey"];

const AUTH_SLUGS: ReadonlySet<LegalSlug> = new Set([
  "imprint",
  "privacy",
  "terms",
  "withdrawal",
  "fair-use",
  "payment",
]);

/** Auth-Footer: unveränderte Kernseiten ohne AVV. */
export const AUTH_LEGAL_PAGES = LEGAL_PAGES.filter((page) => AUTH_SLUGS.has(page.slug));

export function getLegalPage(slug: LegalSlug): LegalPage | undefined {
  return LEGAL_PAGES.find((page) => page.slug === slug);
}

/** Profil/Layout: alle Rechtsseiten; AVV nur für Geschäftskonten. */
export function getProfileLegalPages(isBusiness: boolean): LegalPage[] {
  return LEGAL_PAGES.filter((page) => {
    if ("businessOnly" in page && page.businessOnly) return isBusiness;
    return true;
  });
}

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
