import { useEffect, useMemo, useState } from "react";
import { ChevronDown, PackageSearch } from "lucide-react";

import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "../../components/Router";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import {
  filterCategoryTree,
  isBusinessAccount,
  type ShopBusinessPricing,
  type ShopCategory,
} from "../../lib/shop-catalog";
import { ShopCategoryCard } from "./shop-cards";

export function ShopOverviewScreen() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [businessPricing, setBusinessPricing] = useState<ShopBusinessPricing | null>(null);
  const [defaultTaxName, setDefaultTaxName] = useState("MwSt.");
  const [consumerOpen, setConsumerOpen] = useState(false);

  const isBusiness = isBusinessAccount(user?.accountType);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const data = await api.shop.products(lang);
        if (cancelled) return;
        if (data?.success) {
          setCategories((data.categories ?? []) as ShopCategory[]);
          setBusinessPricing((data.businessPricing as ShopBusinessPricing | null) ?? null);
          setDefaultTaxName(data.defaultTaxName ?? "MwSt.");
          setError(null);
        } else {
          setError(t("unknownError"));
        }
      } catch (err) {
        if (!cancelled) setError(resolveCaughtApiError(err, t));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, t]);

  const visibleCategories = useMemo(
    () => filterCategoryTree(categories, isBusiness),
    [categories, isBusiness],
  );

  const mainCategories = isBusiness
    ? visibleCategories.filter((category) => !category.hiddenForBusiness)
    : visibleCategories.filter((category) => !category.hiddenForPrivate);

  const consumerCategories = isBusiness
    ? visibleCategories.filter((category) => category.hiddenForBusiness)
    : [];

  const pricing = { isBusiness, businessPricing, defaultTaxName };
  const stackMain = mainCategories.length > 0 && mainCategories.length <= 3;
  const mainGridClass = stackMain ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 md:grid-cols-2";

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-6 pb-24 pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">{t("shopTitle")}</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">{t("shopSubtitle")}</p>
        </div>

        {error ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass h-44 animate-pulse" />
            ))}
          </div>
        ) : mainCategories.length === 0 && consumerCategories.length === 0 ? (
          <div className="glass p-10 text-center">
            <PackageSearch className="mx-auto mb-3 size-10 text-(--text-muted)" />
            <p className="text-sm text-(--text-muted)">{t("shopNoProducts")}</p>
          </div>
        ) : (
          <>
            <div className={mainGridClass}>
              {mainCategories.map((category, index) => (
                <ShopCategoryCard
                  key={category.key}
                  category={category}
                  pricing={pricing}
                  className={!stackMain && mainCategories.length % 2 === 1 && index === mainCategories.length - 1 ? "md:col-span-2" : ""}
                  onSelect={() => navigate({ name: "shop-category", categoryKey: category.key })}
                />
              ))}
            </div>

            {consumerCategories.length > 0 ? (
              <div className="glass overflow-hidden">
                <button
                  type="button"
                  onClick={() => setConsumerOpen((open) => !open)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-(--text-primary)">{t("shopConsumerProducts")}</span>
                  <ChevronDown className={`size-4 text-(--text-muted) transition-transform ${consumerOpen ? "rotate-180" : ""}`} />
                </button>
                {consumerOpen ? (
                  <div className="grid grid-cols-1 gap-4 border-t border-(--border) p-5 md:grid-cols-2">
                    {consumerCategories.map((category) => (
                      <ShopCategoryCard
                        key={category.key}
                        category={category}
                        pricing={pricing}
                        onSelect={() => navigate({ name: "shop-category", categoryKey: category.key })}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
