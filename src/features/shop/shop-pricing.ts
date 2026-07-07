import type { ShopBusinessPricing } from "./shop-catalog";

export function formatShopPrice(value: number | string, lang: string): string {
  const numeric = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function displayShopPrice(
  grossPrice: number | string,
  lang: string,
  isBusiness: boolean,
  businessPricing?: ShopBusinessPricing | null,
): string {
  const gross = typeof grossPrice === "number" ? grossPrice : parseFloat(String(grossPrice));
  if (!Number.isFinite(gross)) return "—";
  if (isBusiness && businessPricing) {
    const net = gross / (1 + businessPricing.taxRatePercent / 100);
    const withUpcharge = net * (1 + businessPricing.upchargePercent / 100);
    return formatShopPrice(withUpcharge, lang);
  }
  return formatShopPrice(gross, lang);
}

export function vatLabel(isBusiness: boolean, defaultTaxName?: string, lang = "de"): string {
  if (isBusiness) return lang === "de" ? "zzgl. MwSt." : "excl. VAT";
  return lang === "de" ? `inkl. ${defaultTaxName ?? "MwSt."}` : `incl. ${defaultTaxName ?? "VAT"}`;
}
