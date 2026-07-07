import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";

import { ShopAdvisorWizard } from "../../components/shop/ShopAdvisorWizard";
import { ShopConfiguratorWizard } from "../../components/shop/ShopConfiguratorWizard";
import { useCart } from "../../components/cart/CartProvider";
import { useAuth } from "../../components/AuthProvider";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../components/Router";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import {
  categoryShowsConfigurator,
  filterCategoryVisibility,
  isBusinessAccount,
  type ShopBusinessPricing,
  type ShopCategory,
  type ShopProduct,
} from "../../lib/shop-catalog";
import { categoryHasAdvisor } from "../../lib/shop-consultation";
import { ShopProductCard, ShopSubCategoryCard } from "./shop-cards";

type ShopWizardState =
  | { type: "advisor" }
  | { type: "configurator" }
  | null;

export function ShopCategoryScreen({ categoryKey }: { categoryKey: string }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { navigate, back } = useRouter();
  const { show } = useToast();
  const { addItem } = useCart();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [businessPricing, setBusinessPricing] = useState<ShopBusinessPricing | null>(null);
  const [defaultTaxName, setDefaultTaxName] = useState("MwSt.");
  const [wizard, setWizard] = useState<ShopWizardState>(null);

  const isBusiness = isBusinessAccount(user?.accountType);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.shop.category(categoryKey, lang);
        if (cancelled) return;
        if (data?.success && data.category) {
          const loaded = data.category as ShopCategory;
          const filtered = filterCategoryVisibility(loaded, isBusiness);
          setCategory(filtered ?? loaded);
          setBusinessPricing((data.businessPricing as ShopBusinessPricing | null) ?? null);
          setDefaultTaxName(data.defaultTaxName ?? "MwSt.");
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
  }, [categoryKey, isBusiness, lang, t]);

  const pricing = useMemo(
    () => ({ isBusiness, businessPricing, defaultTaxName }),
    [isBusiness, businessPricing, defaultTaxName],
  );

  const products = category?.products ?? [];
  const children = category?.children ?? [];
  const showAdvisor = category ? categoryHasAdvisor(category) : false;
  const showConfigurator = category ? categoryShowsConfigurator(category) : false;

  const addToCart = (product: ShopProduct) => {
    if (!category) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      categoryId: category.id ?? category.key,
      categoryName: category.name,
      quantity: 1,
      billingCycle: 30,
      priceMonthly: Number(product.priceMonthly) || 0,
      priceYearly: product.priceYearly,
      itemType: "new",
    });
    show(t("productAddedToCart"), "success");
  };

  if (wizard?.type === "advisor" && category) {
    return (
      <ShopAdvisorWizard
        category={category}
        onClose={() => setWizard(null)}
        onSelectCategory={(selected) => {
          setWizard(null);
          navigate({ name: "shop-category", categoryKey: selected.key });
        }}
      />
    );
  }

  if (wizard?.type === "configurator" && category) {
    return <ShopConfiguratorWizard category={category} onClose={() => setWizard(null)} />;
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-8 pb-24 pt-2">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-4" />
          {t("shopBackToProducts")}
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-(--primary)" />
          </div>
        ) : error || !category ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {error ?? t("unknownError")}
          </div>
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold text-(--text-primary)">{category.name}</h1>
              {category.tagline ? (
                <p className="text-sm text-(--primary)">{category.tagline}</p>
              ) : null}
              {category.description ? (
                <p className="max-w-3xl text-sm leading-relaxed text-(--text-secondary)">{category.description}</p>
              ) : null}
            </header>

            {(showAdvisor || showConfigurator) && (
              <div className="flex flex-wrap gap-2">
                {showAdvisor ? (
                  <button
                    type="button"
                    onClick={() => setWizard({ type: "advisor" })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-(--border) px-3 py-2 text-xs font-medium text-(--text-secondary) hover:border-(--elizon-primary)/40 hover:text-(--text-primary)"
                  >
                    <Sparkles className="size-3.5 text-(--elizon-primary)" />
                    {t("shopStartAdvisor")}
                  </button>
                ) : null}
                {showConfigurator ? (
                  <button
                    type="button"
                    onClick={() => setWizard({ type: "configurator" })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-(--border) px-3 py-2 text-xs font-medium text-(--text-secondary) hover:border-(--elizon-primary)/40 hover:text-(--text-primary)"
                  >
                    <SlidersHorizontal className="size-3.5 text-(--elizon-primary)" />
                    {t("shopStartConfigurator")}
                  </button>
                ) : null}
              </div>
            )}

            {products.length > 0 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-medium text-(--text-primary)">{t("shopCategoryPlans")}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <ShopProductCard
                      key={product.id}
                      product={product}
                      category={category}
                      pricing={pricing}
                      onView={() =>
                        navigate({
                          name: "shop-product",
                          categoryKey: category.key,
                          productSlug: product.slug,
                        })
                      }
                      onAddToCart={() => addToCart(product)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {children.length > 0 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-medium text-(--text-primary)">{t("shopCategorySubcategories")}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {children.map((child, index) => (
                    <ShopSubCategoryCard
                      key={child.key}
                      category={child}
                      pricing={pricing}
                      className={children.length % 2 === 1 && index === children.length - 1 ? "md:col-span-2" : ""}
                      onSelect={() => navigate({ name: "shop-category", categoryKey: child.key })}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
