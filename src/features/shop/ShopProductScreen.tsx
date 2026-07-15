import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";

import { ShopProductPanel } from "../../components/shop/ShopProductPanel";
import { ContractBillingSection } from "../../components/shop/ContractBillingSection";
import { AddToCartModal } from "../../components/shop/AddToCartModal";
import { FairUseAcceptLabel, useFairUseAcceptCopy } from "../../components/ui/fair-use-accept-label";
import { useCart } from "../../components/cart/CartProvider";
import { useAuth } from "../../components/AuthProvider";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../components/Router";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { buildProductCartItem } from "../../lib/cart-configured";
import {
  computeProductPriceBreakdown,
  defaultBillingCycle,
  defaultContractBillingInterval,
  filterContractBillingIntervals,
  getBillingOptions,
  initialProductProviderOptions,
} from "../../lib/product-pricing";
import { isBusinessAccount, type ShopBusinessPricing, type ShopCategory } from "../../lib/shop-catalog";
import { productChipLabel, type ShopProductDetail, type ShopUpgradeConfig } from "../../lib/shop-product-detail";
import { displayShopPrice, vatLabel } from "./shop-pricing";

export function ShopProductScreen({
  categoryKey,
  productSlug,
}: {
  categoryKey: string;
  productSlug: string;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { navigate, back } = useRouter();
  const { show } = useToast();
  const { addItem } = useCart();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ShopProductDetail | null>(null);
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [upgradeConfig, setUpgradeConfig] = useState<ShopUpgradeConfig | null>(null);
  const [businessPricing, setBusinessPricing] = useState<ShopBusinessPricing | null>(null);
  const [defaultTaxName, setDefaultTaxName] = useState("MwSt.");
  const [ipv6Pricing, setIpv6Pricing] = useState<Record<string, number> | null>(null);
  const [providerOptions, setProviderOptions] = useState(initialProductProviderOptions({} as ShopProductDetail));
  const [billingCycle, setBillingCycle] = useState(30);
  const [billingMode, setBillingMode] = useState<"PREPAID" | "CONTRACT">("PREPAID");
  const [contractTermMonths, setContractTermMonths] = useState(12);
  const [fairUseAccepted, setFairUseAccepted] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const fairUseCopy = useFairUseAcceptCopy();

  const isBusiness = isBusinessAccount(user?.accountType);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.shop.productDetail(categoryKey, productSlug, lang);
        if (cancelled) return;
        if (data?.success && data.product) {
          const loaded = data.product as ShopProductDetail;
          setProduct(loaded);
          setProviderOptions(initialProductProviderOptions(loaded));
          setBillingCycle(defaultBillingCycle(loaded));
          const terms = loaded.contractTerms ?? [];
          if (terms.length > 0) {
            setContractTermMonths(terms[0].termMonths);
          }
          setBillingMode("PREPAID");
          setCategory(
            (data.category as ShopCategory | undefined) ??
              (loaded.category as unknown as ShopCategory | undefined) ??
              null,
          );
          if (!data.category && !loaded.category) {
            const categoryData = await api.shop.category(categoryKey, lang);
            if (categoryData?.success && categoryData.category) {
              setCategory(categoryData.category as ShopCategory);
            }
          }
          if (data.businessPricing) setBusinessPricing(data.businessPricing as ShopBusinessPricing);
          if (data.defaultTaxName) setDefaultTaxName(data.defaultTaxName);
          const categoryId = loaded.categoryId ?? categoryKey;
          const upgradeRes = await api.shop.upgradeConfig(categoryId);
          if (!cancelled && upgradeRes?.success) setUpgradeConfig(upgradeRes.config ?? null);
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
  }, [categoryKey, productSlug, lang, t]);

  useEffect(() => {
    void api.shop.publicSettings().then((data) => {
      const pricing = data?.settings?.["ipv6.subnet_pricing"];
      if (pricing && typeof pricing === "object") {
        setIpv6Pricing(pricing as Record<string, number>);
      }
    });
  }, []);

  const contractDiscountPercent = useMemo(() => {
    if (!product || billingMode !== "CONTRACT") return undefined;
    const term = (product.contractTerms ?? []).find((row) => row.termMonths === contractTermMonths);
    return term?.discountPercent ?? 0;
  }, [product, billingMode, contractTermMonths]);

  const pricing = useMemo(() => {
    if (!product) return null;
    return computeProductPriceBreakdown({
      product,
      options: providerOptions,
      upgradeConfig,
      ipv6Pricing,
      billingCycle,
      billingMode,
      contractDiscountPercent,
    });
  }, [product, providerOptions, upgradeConfig, ipv6Pricing, billingCycle, billingMode, contractDiscountPercent]);

  const showContractBilling =
    (product?.billingModeAvailability ?? "PREPAID").toUpperCase() !== "PREPAID" &&
    (product?.contractTerms?.length ?? 0) > 0;

  const handleBillingModeChange = (mode: "PREPAID" | "CONTRACT") => {
    setBillingMode(mode);
    if (mode === "CONTRACT" && product) {
      setBillingCycle(defaultContractBillingInterval(product));
    } else if (product) {
      setBillingCycle(defaultBillingCycle(product));
    }
  };

  const chipLabel = productChipLabel(product?.chip);

  const addToCart = async (redirectToCheckout: boolean) => {
    if (!product || !category || !pricing) return;
    if (!fairUseAccepted || product.soldOut) return;

    setAdding(true);
    try {
      addItem(
        buildProductCartItem({
          product,
          options: providerOptions,
          priceMonthly: pricing.priceMonthly,
          billingCycle,
          categoryId: category.id ?? category.key,
          categoryName: category.name,
          upgradeConfig,
          ...(billingMode === "CONTRACT"
            ? { billingMode: "CONTRACT" as const, contractTermMonths }
            : {}),
        }),
      );
      show(t("productAddedToCart"), "success");
      if (redirectToCheckout) {
        navigate({ name: "checkout" });
      } else {
        setShowAddToCartModal(true);
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-4xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-6 pb-24 pt-2">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-4" />
          {category?.name ?? t("shopBackToCategory")}
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-(--primary)" />
          </div>
        ) : error || !product || !pricing ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {error ?? t("unknownError")}
          </div>
        ) : (
          <>
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-(--text-primary)">{product.name}</h1>
                {product.soldOut ? (
                  <span className="rounded-full bg-(--text-muted)/20 px-2 py-1 text-xs font-medium text-(--text-muted)">
                    {t("productSoldOut")}
                  </span>
                ) : null}
              </div>
              {chipLabel ? (
                <span className="inline-flex rounded-full bg-(--elizon-primary)/10 px-3 py-1 text-xs font-medium text-(--elizon-primary)">
                  {chipLabel}
                </span>
              ) : null}
              {product.description ? (
                <p className="text-sm leading-relaxed text-(--text-secondary)">{product.description}</p>
              ) : null}
              {!product.soldOut ? (
                <div>
                  <p className="text-3xl font-bold tabular-nums text-(--elizon-primary)">
                    {displayShopPrice(pricing.periodPrice, lang, isBusiness, businessPricing)}
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    /{billingCycle} {t("days")} · {vatLabel(isBusiness, defaultTaxName, lang)}
                  </p>
                  {billingCycle !== 30 ? (
                    <p className="text-xs text-(--text-muted)">
                      ≈ {displayShopPrice(pricing.equivalentMonthlyPrice, lang, isBusiness, businessPricing)}{" "}
                      {t("productPerMonth")}
                    </p>
                  ) : null}
                  {(product.setupFee ?? 0) > 0 ? (
                    <p className="mt-1 text-sm text-(--text-muted)">
                      {t("productSetupFee")}: {displayShopPrice(product.setupFee ?? 0, lang, isBusiness, businessPricing)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-(--text-muted)">{t("productSoldOutNoOrder")}</p>
              )}
            </header>

            {(product.highlights?.length ?? 0) > 0 ? (
              <section className="flex flex-wrap gap-2">
                {product.highlights!.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-(--border) bg-(--bg-elevated) px-3 py-1 text-xs text-(--text-secondary)"
                  >
                    {highlight}
                  </span>
                ))}
              </section>
            ) : null}

            {!product.soldOut ? (
              <>
                {showContractBilling ? (
                  <ContractBillingSection
                    billingMode={billingMode}
                    onBillingModeChange={handleBillingModeChange}
                    contractTermMonths={contractTermMonths}
                    onContractTermMonthsChange={setContractTermMonths}
                    billingCycleDays={billingCycle}
                    onBillingCycleDaysChange={setBillingCycle}
                    priceMonthly={pricing.priceMonthly}
                    billingModeAvailability={product.billingModeAvailability ?? "PREPAID"}
                    contractTerms={product.contractTerms ?? []}
                    contractBillingIntervals={filterContractBillingIntervals(product)}
                    earlyTerminationFeePercent={product.earlyTerminationFeePercent ?? 50}
                    contractNoticeDays={product.contractNoticeDays ?? 14}
                    contractEligibility={product.contractEligibility}
                    billingOpts={getBillingOptions(product)}
                    lang={lang}
                    isBusiness={isBusiness}
                    businessPricing={businessPricing}
                    t={t}
                  />
                ) : null}

                <ShopProductPanel
                  categoryKey={categoryKey}
                  product={product}
                  upgradeConfig={upgradeConfig}
                  options={providerOptions}
                  onOptionsChange={setProviderOptions}
                  billingCycle={billingCycle}
                  onBillingCycleChange={setBillingCycle}
                  priceMonthly={pricing.priceMonthly}
                  periodPrice={pricing.periodPrice}
                  isBusiness={isBusiness}
                  businessPricing={businessPricing}
                  defaultTaxName={defaultTaxName}
                  hideBillingCycle={billingMode === "CONTRACT"}
                />

                <FairUseAcceptLabel
                  checked={fairUseAccepted}
                  onChange={setFairUseAccepted}
                  acceptPrefix={fairUseCopy.acceptPrefix}
                  acceptSuffix={fairUseCopy.acceptSuffix}
                  policyLabel={fairUseCopy.policyLabel}
                />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={adding || !fairUseAccepted}
                    onClick={() => void addToCart(false)}
                    className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                  >
                    {adding ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                    {t("productOrderCta")}
                  </button>
                  <button
                    type="button"
                    disabled={adding || !fairUseAccepted}
                    onClick={() => void addToCart(true)}
                    className="btn-secondary flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                  >
                    {t("productGoToCheckout")}
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}
      </main>

      <AddToCartModal
        open={showAddToCartModal}
        onClose={() => setShowAddToCartModal(false)}
        onGoToCheckout={() => {
          setShowAddToCartModal(false);
          navigate({ name: "checkout" });
        }}
      />
    </div>
  );
}
