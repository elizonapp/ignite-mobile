import { useEffect, useState } from "react";
import { ArrowLeft, Cpu, HardDrive, Loader2, MemoryStick, ShoppingCart } from "lucide-react";

import { useCart } from "../../components/cart/CartProvider";
import { useAuth } from "../../components/AuthProvider";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../components/Router";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { isBusinessAccount, type ShopBusinessPricing, type ShopCategory } from "../../lib/shop-catalog";
import { numSpec, type ShopProductDetail } from "../../lib/shop-product-detail";
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
  const [businessPricing, setBusinessPricing] = useState<ShopBusinessPricing | null>(null);
  const [defaultTaxName, setDefaultTaxName] = useState("MwSt.");
  const [billingCycle, setBillingCycle] = useState(30);

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
          const loaded = data.product as ShopProductDetail & { category?: ShopCategory };
          setProduct(loaded);
          setCategory(
            (loaded.category as ShopCategory | undefined) ??
              (data.category as ShopCategory | undefined) ??
              null,
          );
          if (!loaded.category && !data.category) {
            const categoryData = await api.shop.category(categoryKey, lang);
            if (categoryData?.success && categoryData.category) {
              setCategory(categoryData.category as ShopCategory);
            }
          }
          if (data.businessPricing) {
            setBusinessPricing(data.businessPricing as ShopBusinessPricing);
          }
          if (data.defaultTaxName) {
            setDefaultTaxName(data.defaultTaxName);
          }
          const cycles = (loaded.allowedBillingCycles ?? [30]).filter((cycle) =>
            [7, 14, 30, 60, 90, 120, 180, 365].includes(cycle),
          );
          setBillingCycle(cycles.includes(30) ? 30 : cycles[0] ?? 30);
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

  const addToCart = () => {
    if (!product || !category) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      categoryId: category.id ?? category.key,
      categoryName: category.name,
      quantity: 1,
      billingCycle,
      priceMonthly: Number(product.priceMonthly) || 0,
      priceYearly: product.priceYearly,
      itemType: "new",
    });
    show(t("productAddedToCart"), "success");
  };

  const cycles = (product?.allowedBillingCycles ?? [30]).filter((cycle) =>
    [7, 14, 30, 60, 90, 120, 180, 365].includes(cycle),
  );

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
        ) : error || !product ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {error ?? t("unknownError")}
          </div>
        ) : (
          <>
            <header className="space-y-3">
              <h1 className="text-2xl font-semibold text-(--text-primary)">{product.name}</h1>
              {product.description ? (
                <p className="text-sm leading-relaxed text-(--text-secondary)">{product.description}</p>
              ) : null}
              <div>
                <p className="text-3xl font-bold text-(--elizon-primary)">
                  {displayShopPrice(product.priceMonthly, lang, isBusiness, businessPricing)}
                  <span className="text-sm font-normal text-(--text-muted)">{t("shopPerMonth")}</span>
                </p>
                <p className="text-xs text-(--text-muted)">
                  {vatLabel(isBusiness, defaultTaxName, lang)}
                </p>
              </div>
            </header>

            <section className="glass space-y-3 p-4">
              <h2 className="text-sm font-medium text-(--text-primary)">{t("shopProductSpecs")}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <SpecRow icon={<Cpu className="size-4" />} label="vCPU" value={String(numSpec(product.vcores, 0))} />
                <SpecRow icon={<MemoryStick className="size-4" />} label="RAM" value={`${numSpec(product.memory, 0)} GB`} />
                <SpecRow icon={<HardDrive className="size-4" />} label={t("shopStorage")} value={`${numSpec(product.storage, 0)} GB`} />
              </div>
            </section>

            {cycles.length > 1 ? (
              <section className="glass space-y-2 p-4">
                <label className="text-sm font-medium text-(--text-primary)">{t("checkoutBillingCycle")}</label>
                <select
                  value={billingCycle}
                  onChange={(event) => setBillingCycle(Number(event.target.value))}
                  className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary)"
                >
                  {cycles.map((cycle) => (
                    <option key={cycle} value={cycle}>
                      {cycle} {t("days")}
                    </option>
                  ))}
                </select>
              </section>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={addToCart}
                className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
              >
                <ShoppingCart className="size-4" />
                {t("shopAddToCart")}
              </button>
              <button
                type="button"
                onClick={() => {
                  addToCart();
                  navigate({ name: "checkout" });
                }}
                className="btn-secondary flex-1 rounded-xl py-3 text-sm font-semibold"
              >
                {t("cartGoToCheckout")}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2">
      <span className="text-(--text-muted)">{icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-(--text-muted)">{label}</p>
        <p className="text-sm font-semibold text-(--text-primary)">{value}</p>
      </div>
    </div>
  );
}
