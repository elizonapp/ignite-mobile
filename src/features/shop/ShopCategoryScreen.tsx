import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";

import { ShopAdvisorSection } from "../../components/shop/ShopAdvisorSection";
import { ShopConfiguratorSection } from "../../components/shop/ShopConfiguratorSection";
import { ShopControlsBar } from "../../components/shop/ShopControlsBar";
import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "../../components/Router";
import { useToast } from "../../components/Toast";
import { FairUseCheckoutDialog } from "../../components/ui/fair-use-checkout-dialog";
import { useFairUseAcceptCopy } from "../../components/ui/fair-use-accept-label";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { useCart } from "../../components/cart/CartProvider";
import { isElizonPlusCustomerUiVisible } from "../../lib/elizon-plus";
import {
  categoryShowsConfigurator,
  type ShopBusinessPricing,
  type ShopCategory,
  type ShopProduct,
} from "../../lib/shop-catalog";
import { categoryHasAdvisor } from "../../lib/shop-consultation";
import { useShopAudience } from "../../components/shop/ShopAudienceProvider";
import {
  calculateBestValueSlug,
  categoryHeroSubtitle,
  computePlanCardRowSync,
} from "./shop-plan-utils";
import { useShopPricingState } from "./shop-pricing";
import { ShopProductCard, ShopSubCategoryCard } from "./shop-cards";

export function ShopCategoryScreen({ categoryKey }: { categoryKey: string }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { navigate, back } = useRouter();
  const { show } = useToast();
  const { addItem } = useCart();
  const fairUseCopy = useFairUseAcceptCopy();
  const { isBusinessAudience } = useShopAudience();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [businessPricing, setBusinessPricing] = useState<ShopBusinessPricing | null>(null);
  const [defaultTaxName, setDefaultTaxName] = useState("MwSt.");
  const [consumerOpen, setConsumerOpen] = useState(false);
  const [showFairUseDialog, setShowFairUseDialog] = useState(false);
  const [fairUseAccepted, setFairUseAccepted] = useState(false);
  const [pendingCheckoutProduct, setPendingCheckoutProduct] = useState<ShopProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.shop.category(categoryKey, lang);
        if (cancelled) return;
        if (data?.success && data.category) {
          setCategory(data.category as ShopCategory);
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
  }, [categoryKey, lang, t]);

  const { priceContext, fmt } = useShopPricingState(businessPricing, defaultTaxName);
  const pricing = useMemo(() => ({ priceContext }), [priceContext]);

  const products = category?.products ?? [];
  const allChildren = category?.children ?? [];

  const mainSubcategories = useMemo(
    () =>
      allChildren.filter((child) =>
        isBusinessAudience ? !child.hiddenForBusiness : !child.hiddenForPrivate,
      ),
    [allChildren, isBusinessAudience],
  );

  const consumerSubcategories = useMemo(
    () => allChildren.filter((child) => isBusinessAudience && child.hiddenForBusiness),
    [allChildren, isBusinessAudience],
  );

  const showAdvisor = category ? categoryHasAdvisor(category) : false;
  const showConfigurator = category ? categoryShowsConfigurator(category) : false;
  const showInlineAdvisor = showAdvisor && mainSubcategories.length > 0;
  const showStandaloneAdvisor = showAdvisor && mainSubcategories.length === 0;

  const bestValueSlug = useMemo(() => calculateBestValueSlug(products), [products]);
  const elizonPlusCustomerSurfaceVisible = isElizonPlusCustomerUiVisible(user);
  const isElizonPlusActive = Boolean(elizonPlusCustomerSurfaceVisible && user?.elizonPlusActive);
  const planCardRowSync = useMemo(
    () =>
      computePlanCardRowSync({
        products,
        bestValueSlug,
        elizonPlusCustomerSurfaceVisible,
        isElizonPlusActive,
      }),
    [products, bestValueSlug, elizonPlusCustomerSurfaceVisible, isElizonPlusActive],
  );

  const hasMonthlyOffersInCategory = products.some(
    (product) => Number(product.monthlyOffer?.discountPercent ?? 0) > 0,
  );

  const heroSubtitle = category ? categoryHeroSubtitle(category, t) : t("categoryHeroSubtitle");
  const hasDirectPlans = products.length > 0;
  const isParentCategory = allChildren.length > 0;
  const hasConsultation = showAdvisor;

  const goToProduct = (product: ShopProduct) => {
    if (!category) return;
    navigate({
      name: "shop-product",
      categoryKey: category.key,
      productSlug: product.slug,
    });
  };

  const performDirectToCheckout = (product: ShopProduct) => {
    // Provider products need full configuration on the product detail page.
    if (showConfigurator || category?.provider) {
      goToProduct(product);
      return;
    }
    if (!category) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      categoryId: category.id ?? category.key,
      categoryName: category.name,
      quantity: 1,
      billingCycle: 30,
      priceMonthly: parseFloat(String(product.priceMonthly)) || 0,
      itemType: "new",
    });
    show(t("productAddedToCart"), "success");
    navigate({ name: "checkout" });
  };

  const handleDirectToCheckout = (product: ShopProduct) => {
    if (showConfigurator || category?.provider) {
      goToProduct(product);
      return;
    }
    setPendingCheckoutProduct(product);
    setFairUseAccepted(false);
    setShowFairUseDialog(true);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const productGridItems = useMemo(() => {
    if (!category) return [] as ReactNode[];
    const nodes: ReactNode[] = [];
    products.forEach((product, index) => {
      if (showConfigurator && products.length > 3 && index === 3) {
        nodes.push(
          <ShopConfiguratorSection key="configurator-inline" category={category} pricing={pricing} />,
        );
      }
      nodes.push(
        <ShopProductCard
          key={product.id}
          product={product}
          category={category}
          pricing={pricing}
          rowSync={planCardRowSync}
          isBestValue={product.slug === bestValueSlug}
          user={user}
          onView={() => goToProduct(product)}
          onDirectToCheckout={() => handleDirectToCheckout(product)}
          onElizonPlusClick={() => navigate({ name: "elizon-plus" })}
        />,
      );
    });
    if (showConfigurator && products.length <= 3) {
      nodes.push(
        <ShopConfiguratorSection key="configurator-inline" category={category} pricing={pricing} />,
      );
    }
    return nodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers stable enough for grid memo
  }, [category, products, pricing, showConfigurator, planCardRowSync, bestValueSlug, user]);

  const subcategoryGridItems = useMemo(() => {
    if (!category) return [] as ReactNode[];
    const stack = mainSubcategories.length > 0 && mainSubcategories.length <= 3;
    const cards: ReactNode[] = mainSubcategories.map((child, index) => (
      <ShopSubCategoryCard
        key={child.key}
        category={child}
        pricing={pricing}
        className={!stack && mainSubcategories.length % 2 === 1 && index === mainSubcategories.length - 1 ? "md:col-span-2" : ""}
        onSelect={() => navigate({ name: "shop-category", categoryKey: child.key })}
      />
    ));
    if (showInlineAdvisor) {
      const insertAt = Math.min(4, cards.length);
      cards.splice(
        insertAt,
        0,
        <ShopAdvisorSection
          key="advisor-inline"
          category={category}
          className="md:col-span-2"
          onSelectCategory={(selected) => navigate({ name: "shop-category", categoryKey: selected.key })}
        />,
      );
    }
    return cards;
  }, [category, mainSubcategories, pricing, showInlineAdvisor, navigate]);

  const lowestMonthlyPrice = useMemo(() => {
    const prices = products
      .filter((product) => !product.soldOut)
      .map((product) => parseFloat(String(product.priceMonthly)))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (prices.length === 0) return null;
    return fmt(String(Math.min(...prices)), lang);
  }, [products, fmt, lang]);

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

        <ShopControlsBar defaultTaxName={defaultTaxName} />

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
            <header className="glass space-y-4 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-(--text-muted)">{t("categoryPill")}</p>
                <h1 className="text-2xl font-semibold text-(--text-primary)">{category.name}</h1>
                <p className="max-w-3xl text-sm text-(--text-secondary)">{heroSubtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {isParentCategory || hasDirectPlans ? (
                  <button
                    type="button"
                    onClick={() => scrollToSection(hasDirectPlans ? "category-plans" : "category-subcategories")}
                    className="btn-primary rounded-xl px-5 py-3 text-sm font-semibold"
                  >
                    {hasDirectPlans ? t("categoryHeroPrimaryCta") : t("categoryHeroPrimaryCtaSubcategories")}
                  </button>
                ) : null}
                {hasConsultation ? (
                  <button
                    type="button"
                    onClick={() => scrollToSection("category-advisor")}
                    className="btn-secondary rounded-xl px-5 py-3 text-sm font-semibold"
                  >
                    {t("categoryHeroSecondaryCta")}
                  </button>
                ) : null}
              </div>
              {isParentCategory && hasDirectPlans && lowestMonthlyPrice ? (
                <div className="inline-flex rounded-2xl border border-(--border) bg-(--bg-elevated)/70 px-4 py-3">
                  <p className="text-sm text-(--text-secondary)">
                    <span className="text-xs uppercase tracking-wide text-(--text-muted)">{t("categoryTrustStartingAt")}</span>{" "}
                    <span className="ml-2 text-lg font-semibold text-(--text-primary)">{lowestMonthlyPrice}</span>
                  </p>
                </div>
              ) : null}
            </header>

            {products.length > 0 ? (
              <section id="category-plans" className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-(--text-primary)">{t("categoryHighlightsTitle")}</h2>
                  <p className="text-sm text-(--text-secondary)">{t("categoryHighlightsSubtitle")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{productGridItems}</div>
                {bestValueSlug && products.length >= 2 ? (
                  <p className="glass p-4 text-xs leading-relaxed text-(--text-muted)">
                    <span className="font-medium">{t("productBestValueCalculation")}:</span> {t("productBestValueExplanation")}
                  </p>
                ) : null}
              </section>
            ) : null}

            {mainSubcategories.length > 0 ? (
              <section id="category-subcategories" className="space-y-4">
                <h2 className="text-lg font-medium text-(--text-primary)">{t("categorySubcategoriesTitle")}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{subcategoryGridItems}</div>
              </section>
            ) : null}

            {showStandaloneAdvisor ? (
              <ShopAdvisorSection
                category={category}
                onSelectCategory={(selected) => navigate({ name: "shop-category", categoryKey: selected.key })}
              />
            ) : null}

            {isBusinessAudience && consumerSubcategories.length > 0 ? (
              <section className="glass overflow-hidden">
                <button
                  type="button"
                  onClick={() => setConsumerOpen((open) => !open)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={consumerOpen}
                >
                  <span className="text-sm font-medium text-(--text-primary)">{t("consumerProductsLabel")}</span>
                  <ChevronDown className={`size-4 text-(--text-muted) transition-transform ${consumerOpen ? "rotate-180" : ""}`} />
                </button>
                {consumerOpen ? (
                  <div className="grid grid-cols-1 gap-4 border-t border-(--border) p-5 md:grid-cols-2">
                    {consumerSubcategories.map((child) => (
                      <ShopSubCategoryCard
                        key={child.key}
                        category={child}
                        pricing={pricing}
                        onSelect={() => navigate({ name: "shop-category", categoryKey: child.key })}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {mainSubcategories.length === 0 && consumerSubcategories.length === 0 && products.length === 0 ? (
              <div className="glass p-8 text-center text-sm text-(--text-secondary)">{t("productsEmptyCategory")}</div>
            ) : null}

            {hasDirectPlans ? (
              <section className="glass p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-(--text-primary)">{t("categoryFinalCtaTitle")}</h2>
                    <p className="mt-1 text-sm text-(--text-secondary)">{t("categoryFinalCtaBody")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollToSection("category-plans")}
                    className="btn-primary shrink-0 rounded-xl px-5 py-3 text-sm font-semibold"
                  >
                    {t("categoryFinalCtaButton")}
                  </button>
                </div>
              </section>
            ) : null}

            {hasMonthlyOffersInCategory && isElizonPlusActive ? (
              <p className="glass px-4 py-3 text-xs leading-relaxed text-(--text-muted)">
                * {t("elizonPlusMonthlyOfferFootnote")}
              </p>
            ) : null}
          </>
        )}
      </main>

      <FairUseCheckoutDialog
        open={showFairUseDialog && pendingCheckoutProduct != null}
        title={t("productGoToCheckout")}
        checked={fairUseAccepted}
        onCheckedChange={setFairUseAccepted}
        acceptPrefix={fairUseCopy.acceptPrefix}
        acceptSuffix={fairUseCopy.acceptSuffix}
        policyLabel={fairUseCopy.policyLabel}
        cancelLabel={t("cancel")}
        confirmLabel={t("productGoToCheckout")}
        onCancel={() => {
          setShowFairUseDialog(false);
          setPendingCheckoutProduct(null);
          setFairUseAccepted(false);
        }}
        onConfirm={() => {
          if (!pendingCheckoutProduct) return;
          const product = pendingCheckoutProduct;
          setShowFairUseDialog(false);
          setPendingCheckoutProduct(null);
          setFairUseAccepted(false);
          performDirectToCheckout(product);
        }}
      />
    </div>
  );
}
