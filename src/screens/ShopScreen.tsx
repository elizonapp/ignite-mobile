import { useEffect, useRef, useState } from "react";
import { PackageSearch, ShoppingCart, Cpu, MemoryStick, HardDrive, Sparkles, SlidersHorizontal } from "lucide-react";

import { ShopAdvisorWizard, categoryShowsAdvisor, categoryShowsConfigurator } from "../components/shop/ShopAdvisorWizard";
import { ShopConfiguratorWizard } from "../components/shop/ShopConfiguratorWizard";
import { useCart } from "../components/cart/CartProvider";
import { useAuth } from "../components/AuthProvider";
import { useToast } from "../components/Toast";
import { useI18n } from '../i18n';
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { api } from '../lib/api';
import { useRouter } from '../components/Router';
import {
  filterCategoryTree,
  isBusinessAccount,
  type ShopCategory,
  type ShopProduct,
} from "../lib/shop-catalog";

type ProductsResponse = {
  success: boolean;
  categories?: ShopCategory[];
};

type ShopWizardState =
  | { type: "advisor"; category: ShopCategory }
  | { type: "configurator"; category: ShopCategory }
  | null;

export function ShopScreen() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const { addItem, itemCount } = useCart();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [countries, setCountries] = useState<Array<{ countryCode: string; countryName: string; isDefault?: boolean }>>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [wizard, setWizard] = useState<ShopWizardState>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const isBusiness = isBusinessAccount(user?.accountType);
  const visibleCategories = filterCategoryTree(categories, isBusiness);

  useEffect(() => {
    if (!highlightKey || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = window.setTimeout(() => setHighlightKey(null), 2500);
    return () => window.clearTimeout(timer);
  }, [highlightKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = (await api.shop.products(lang)) as ProductsResponse;
        if (cancelled) return;
        if (data?.success) {
          setCategories(data.categories ?? []);
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
    return () => { cancelled = true; };
  }, [t, lang]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.shop.countries();
        if (cancelled || !data?.success) return;
        const list = Array.isArray(data.countries) ? data.countries : [];
        setCountries(list);
        if (!selectedCountryCode && list.length > 0) {
          const defaultCountry = list.find((c) => c.isDefault) ?? list[0];
          if (defaultCountry) {
            setSelectedCountryCode(defaultCountry.countryCode);
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCountryCode]);

  const addToCart = (product: ShopProduct, category: ShopCategory) => {
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

  const handleAdvisorCategory = (category: ShopCategory) => {
    setHighlightKey(category.key);
  };

  const hasProducts = visibleCategories.some(
    (category) => category.products.length > 0 || (category.children?.length ?? 0) > 0,
  );

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      {wizard?.type === "advisor" ? (
        <ShopAdvisorWizard
          category={wizard.category}
          onClose={() => setWizard(null)}
          onSelectCategory={handleAdvisorCategory}
        />
      ) : null}
      {wizard?.type === "configurator" ? (
        <ShopConfiguratorWizard category={wizard.category} onClose={() => setWizard(null)} />
      ) : null}

      <main className="safe-x flex-1 space-y-6 pb-24 pt-2">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => navigate({ name: "cart" })}
            className="relative inline-flex items-center gap-1.5 rounded-xl border border-(--border) px-3 py-2 text-xs font-medium text-(--text-secondary) hover:bg-(--bg-elevated)"
          >
            <ShoppingCart className="size-4" />
            {t("navCart")}
            {itemCount > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-(--elizon-primary) px-1.5 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
        {error ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass animate-pulse h-44" />
            ))}
          </div>
        ) : !hasProducts ? (
          <div className="glass p-10 text-center">
            <PackageSearch className="mx-auto mb-3 size-10 text-(--text-muted)" />
            <p className="text-sm text-(--text-muted)">{t("shopNoProducts")}</p>
          </div>
        ) : (
          <>
            {visibleCategories.map((category) => (
              <CategorySection
                key={category.key}
                category={category}
                onAddToCart={addToCart}
                onStartAdvisor={(entry) => setWizard({ type: "advisor", category: entry })}
                onStartConfigurator={(entry) => setWizard({ type: "configurator", category: entry })}
                highlightKey={highlightKey}
                highlightRef={highlightRef}
                depth={0}
              />
            ))}

            {countries.length > 0 && (
              <div className="glass border border-(--border) p-4">
                <label className="mb-2 block text-sm font-medium text-(--text-primary)">
                  {t("shopTaxCountryLabel")}
                </label>
                <select
                  value={selectedCountryCode ?? ""}
                  onChange={(event) => setSelectedCountryCode(event.target.value || null)}
                  className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:border-(--primary)"
                >
                  {countries.map((country) => (
                    <option key={country.countryCode} value={country.countryCode}>
                      {country.countryName} ({country.countryCode})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-(--text-muted)">{t("shopTaxCountryHelp")}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function CategorySection({
  category,
  onAddToCart,
  onStartAdvisor,
  onStartConfigurator,
  highlightKey,
  highlightRef,
  depth,
}: {
  category: ShopCategory;
  onAddToCart: (product: ShopProduct, category: ShopCategory) => void;
  onStartAdvisor: (category: ShopCategory) => void;
  onStartConfigurator: (category: ShopCategory) => void;
  highlightKey: string | null;
  highlightRef: React.RefObject<HTMLDivElement | null>;
  depth: number;
}) {
  const { t } = useI18n();
  const hasProducts = category.products.length > 0;
  const children = category.children ?? [];
  const showAdvisor = categoryShowsAdvisor(category);
  const showConfigurator = categoryShowsConfigurator(category);
  const isHighlighted = highlightKey === category.key;

  if (!hasProducts && children.length === 0 && !showAdvisor) return null;

  return (
    <section
      ref={isHighlighted ? highlightRef : undefined}
      className={`space-y-3 rounded-xl transition-colors ${isHighlighted ? "ring-2 ring-(--elizon-primary)/40" : ""}`}
    >
      <div className={depth > 0 ? "pl-3 border-l border-(--border)" : undefined}>
        <h2 className={`font-semibold text-(--text-primary) ${depth === 0 ? "text-sm" : "text-xs"}`}>{category.name}</h2>
        {category.description && (
          <p className="text-xs text-(--text-muted)">{category.description}</p>
        )}

        {(showAdvisor || showConfigurator) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {showAdvisor ? (
              <button
                type="button"
                onClick={() => onStartAdvisor(category)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-(--border) px-3 py-2 text-xs font-medium text-(--text-secondary) hover:border-(--elizon-primary)/40 hover:text-(--text-primary)"
              >
                <Sparkles className="size-3.5 text-(--elizon-primary)" />
                {t("shopStartAdvisor")}
              </button>
            ) : null}
            {showConfigurator ? (
              <button
                type="button"
                onClick={() => onStartConfigurator(category)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-(--border) px-3 py-2 text-xs font-medium text-(--text-secondary) hover:border-(--elizon-primary)/40 hover:text-(--text-primary)"
              >
                <SlidersHorizontal className="size-3.5 text-(--elizon-primary)" />
                {t("shopStartConfigurator")}
              </button>
            ) : null}
          </div>
        )}

        {hasProducts && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.products.map((product) => (
              <ProductCard key={product.id} product={product} category={category} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
        {children.length > 0 && (
          <div className="mt-4 space-y-4">
            {children.map((child) => (
              <CategorySection
                key={child.key}
                category={child}
                onAddToCart={onAddToCart}
                onStartAdvisor={onStartAdvisor}
                onStartConfigurator={onStartConfigurator}
                highlightKey={highlightKey}
                highlightRef={highlightRef}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  category,
  onAddToCart,
}: {
  product: ShopProduct;
  category: ShopCategory;
  onAddToCart: (product: ShopProduct, category: ShopCategory) => void;
}) {
  const { t, lang } = useI18n();

  const priceValue = product.priceMonthly != null ? Number(product.priceMonthly) : 0;
  const formatPrice = (value: number) =>
    new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="glass flex flex-col gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-(--text-primary)">{product.name}</p>
        {product.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-(--text-muted)">{product.description}</p>
        )}
      </div>

      {(product.vcores || product.memory || product.storage) ? (
        <div className="flex flex-wrap gap-2">
          {!!product.vcores && (
            <Spec icon={<Cpu className="size-3" />} label={`${product.vcores} vCPU`} />
          )}
          {!!product.memory && (
            <Spec icon={<MemoryStick className="size-3" />} label={`${product.memory} GB`} />
          )}
          {!!product.storage && (
            <Spec icon={<HardDrive className="size-3" />} label={`${product.storage} GB`} />
          )}
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-2">
        {product.priceMonthly != null ? (
          <div>
            <span className="text-base font-bold text-(--elizon-primary)">
              {formatPrice(priceValue)}
            </span>
            <span className="text-xs text-(--text-muted)">{t("shopPerMonth")}</span>
          </div>
        ) : (
          <span className="text-xs text-(--text-muted)">—</span>
        )}
        <button
          type="button"
          onClick={() => onAddToCart(product, category)}
          className="btn-primary flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
        >
          <ShoppingCart className="size-3" />
          {t("shopAddToCart")}
        </button>
      </div>
    </div>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-(--surface-soft) px-2 py-0.5 text-[10px] text-(--text-muted)">
      {icon}
      {label}
    </span>
  );
}
