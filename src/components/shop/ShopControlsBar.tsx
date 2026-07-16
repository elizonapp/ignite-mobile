import { useMemo } from "react";

import { useI18n } from "../../i18n";
import type { ShopBusinessPricing } from "../../lib/shop-catalog";
import { shopVatLabel, type ShopPriceContext } from "../../lib/tax-pricing";
import { useShopAudience } from "./ShopAudienceProvider";
import { useShopTaxCountry } from "./ShopTaxCountryProvider";

export function ShopControlsBar({
  defaultTaxName = "MwSt.",
  className = "",
}: {
  defaultTaxName?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { audience, setAudience } = useShopAudience();
  const { countries, selectedCountryCode, setSelectedCountryCode, loading } = useShopTaxCountry();

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div
        role="radiogroup"
        aria-label={t("shopAudienceGroupLabel")}
        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-(--border) bg-(--bg-elevated) p-1"
      >
        {(["private", "business"] as const).map((value) => {
          const active = audience === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setAudience(value)}
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:min-h-0 sm:text-sm ${
                active
                  ? "bg-(--primary)/10 text-(--primary)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {value === "private" ? t("shopAudiencePrivate") : t("shopAudienceBusiness")}
            </button>
          );
        })}
      </div>

      <div className="min-w-0 flex-1 sm:max-w-xs">
        <label htmlFor="shop-tax-country" className="mb-1 block text-xs font-medium text-(--text-muted)">
          {t("shopTaxCountryLabel")}
        </label>
        <select
          id="shop-tax-country"
          value={selectedCountryCode ?? ""}
          disabled={loading || countries.length === 0}
          onChange={(event) => setSelectedCountryCode(event.target.value || null)}
          className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
        >
          {countries.map((country) => (
            <option key={country.countryCode} value={country.countryCode}>
              {country.countryName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-(--text-muted)">{t("shopTaxCountryHelp")}</p>
      </div>
    </div>
  );
}

export function useShopPriceContext(businessPricing?: ShopBusinessPricing | null, defaultTaxName = "MwSt.") {
  const { isBusinessAudience } = useShopAudience();
  const { homeCountry, selectedCountry } = useShopTaxCountry();

  return useMemo<ShopPriceContext>(
    () => ({
      isBusinessAudience,
      businessPricing,
      homeCountry,
      selectedCountry,
      defaultTaxName,
    }),
    [isBusinessAudience, businessPricing, homeCountry, selectedCountry, defaultTaxName],
  );
}

export function useShopVatLabel(priceContext: ShopPriceContext, lang: string) {
  return useMemo(() => shopVatLabel(priceContext, lang), [priceContext, lang]);
}
