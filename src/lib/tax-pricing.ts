import type { ShopBusinessPricing } from "./shop-catalog";

export type TaxCountry = {
  countryCode: string;
  countryName: string;
  taxRate: number;
  taxName: string | null;
  isDefault: boolean;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function grossToNet(gross: number, vatRatePercent: number): number {
  return gross / (1 + Math.max(0, vatRatePercent) / 100);
}

export function netToGross(net: number, vatRatePercent: number): number {
  return net * (1 + Math.max(0, vatRatePercent) / 100);
}

export function adjustGrossFromHomeToDestination(
  grossHomeInput: number | string | null | undefined,
  rateHomePct: number,
  rateDestPct: number,
): number {
  const grossHome = typeof grossHomeInput === "string" ? parseFloat(grossHomeInput) : (grossHomeInput ?? 0);
  if (!Number.isFinite(grossHome) || grossHome <= 0) return 0;

  const homePct = Math.max(0, rateHomePct);
  const destPct = Math.max(0, rateDestPct);

  if (destPct <= homePct) return roundMoney(grossHome);

  const net = grossToNet(grossHome, homePct);
  return roundMoney(netToGross(net, destPct));
}

export function computeBusinessPrice(
  grossPrice: number | string | null | undefined,
  taxRatePercent: number,
  upchargePercent: number,
): number {
  const gross = typeof grossPrice === "string" ? parseFloat(grossPrice) : (grossPrice ?? 0);
  if (!gross || !Number.isFinite(gross)) return 0;
  return netToGross(grossToNet(gross, taxRatePercent), upchargePercent);
}

export function taxRateToPercent(taxRate: number | null | undefined): number {
  if (taxRate == null || !Number.isFinite(Number(taxRate))) return 0;
  const rate = Number(taxRate);
  if (rate <= 1 && rate >= 0) return Math.round(rate * 10000) / 100;
  return Math.round(rate * 100) / 100;
}

export function formatTaxIncludedLabel(taxName: string, taxRatePercent: number, lang: string): string {
  const name = (taxName || (lang === "de" ? "MwSt." : "VAT")).trim();
  const rate = Number.isFinite(taxRatePercent) ? taxRatePercent : 0;
  const r = rate % 1 === 0 ? String(Math.round(rate)) : String(Math.round(rate * 100) / 100);
  if (lang === "de") return `${name} enthalten (${r} %)`;
  return `${name} included (${r}%)`;
}

export function formatTaxExclLabel(taxName: string, taxRatePercent: number, lang: string): string {
  const name = (taxName || (lang === "de" ? "MwSt." : "VAT")).trim();
  const rate = Number.isFinite(taxRatePercent) ? taxRatePercent : 0;
  const r = rate % 1 === 0 ? String(Math.round(rate)) : String(Math.round(rate * 100) / 100);
  if (lang === "de") return `zzgl. ${name} (${r} %)`;
  return `excl. ${name} (${r}%)`;
}

export type ShopPriceContext = {
  isBusinessAudience: boolean;
  businessPricing?: ShopBusinessPricing | null;
  homeCountry?: TaxCountry | null;
  selectedCountry?: TaxCountry | null;
  defaultTaxName?: string;
};

export function resolveDisplayGross(
  grossPrice: number | string,
  ctx: ShopPriceContext,
): number {
  const gross = typeof grossPrice === "number" ? grossPrice : parseFloat(String(grossPrice));
  if (!Number.isFinite(gross)) return 0;

  if (ctx.isBusinessAudience && ctx.businessPricing) {
    return computeBusinessPrice(gross, ctx.businessPricing.taxRatePercent, ctx.businessPricing.upchargePercent);
  }

  const rateHomePct =
    ctx.homeCountry != null ? taxRateToPercent(ctx.homeCountry.taxRate) : 19;
  const rateDestPct =
    ctx.selectedCountry != null ? taxRateToPercent(ctx.selectedCountry.taxRate) : rateHomePct;

  return adjustGrossFromHomeToDestination(gross, rateHomePct, rateDestPct);
}

export function shopVatLabel(ctx: ShopPriceContext, lang: string): string {
  const taxName = ctx.selectedCountry?.taxName ?? ctx.defaultTaxName ?? "MwSt.";
  const taxRatePct =
    ctx.selectedCountry != null ? taxRateToPercent(ctx.selectedCountry.taxRate) : 0;
  const tl = lang === "de" ? "de" : "en";

  if (ctx.isBusinessAudience && ctx.businessPricing) {
    return formatTaxExclLabel(taxName, taxRatePct, tl);
  }
  return formatTaxIncludedLabel(taxName, taxRatePct, tl);
}
