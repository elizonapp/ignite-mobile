import { useShopAudience } from "../../components/shop/ShopAudienceProvider";
import { useShopTaxCountry } from "../../components/shop/ShopTaxCountryProvider";
import type { ShopBusinessPricing } from "../../lib/shop-catalog";
import {
  resolveDisplayGross,
  shopVatLabel,
  type ShopPriceContext,
} from "../../lib/tax-pricing";

export type CardPricing = {
  priceContext: ShopPriceContext;
};

export function buildCardPricing(
  isBusinessAudience: boolean,
  businessPricing?: ShopBusinessPricing | null,
  homeCountry?: ShopPriceContext["homeCountry"],
  selectedCountry?: ShopPriceContext["selectedCountry"],
  defaultTaxName?: string,
): CardPricing {
  return {
    priceContext: {
      isBusinessAudience,
      businessPricing,
      homeCountry,
      selectedCountry,
      defaultTaxName,
    },
  };
}

export function displayShopPrice(
  grossPrice: number | string,
  lang: string,
  priceContextOrBusiness: ShopPriceContext | boolean,
  businessPricing?: ShopBusinessPricing | null,
): string {
  const priceContext: ShopPriceContext =
    typeof priceContextOrBusiness === "boolean"
      ? { isBusinessAudience: priceContextOrBusiness, businessPricing }
      : priceContextOrBusiness;
  return formatShopPrice(resolveDisplayGross(grossPrice, priceContext), lang);
}

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

export function vatLabelFromContext(priceContext: ShopPriceContext, lang: string): string {
  return shopVatLabel(priceContext, lang);
}

/** @deprecated Use vatLabelFromContext with ShopPriceContext */
export function vatLabel(isBusiness: boolean, defaultTaxName?: string, lang = "de"): string {
  return shopVatLabel(
    { isBusinessAudience: isBusiness, defaultTaxName },
    lang,
  );
}

export function useShopPricingState(businessPricing?: ShopBusinessPricing | null, defaultTaxName = "MwSt.") {
  const { isBusinessAudience } = useShopAudience();
  const { homeCountry, selectedCountry } = useShopTaxCountry();

  const priceContext: ShopPriceContext = {
    isBusinessAudience,
    businessPricing,
    homeCountry,
    selectedCountry,
    defaultTaxName,
  };

  const fmt = (value: number | string, lang: string) => displayShopPrice(value, lang, priceContext);
  const vat = (lang: string) => shopVatLabel(priceContext, lang);

  return { priceContext, fmt, vat, isBusinessAudience };
}
