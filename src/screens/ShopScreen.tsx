import { useEffect, useState } from "react";
import { ExternalLink, PackageSearch, ShoppingCart, Cpu, MemoryStick, HardDrive } from "lucide-react";

import { useI18n } from '../i18n';
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { api } from '../lib/api';
import { canPurchase } from '../lib/platform';
import { getApiBaseUrl } from '../lib/config';
import { useRouter } from '../components/Router';

type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  priceMonthly?: number | null;
  priceYearly?: number | null;
  vcores?: number;
  memory?: number;
  storage?: number;
  highlights?: string[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  products: Product[];
  children: Array<{ id: string; name: string; products: Product[] }>;
};

type ProductsResponse = {
  success: boolean;
  categories?: Category[];
};

export function ShopScreen() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Array<{ countryCode: string; countryName: string; isDefault?: boolean }>>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);

  const canOrder = canPurchase();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.shop.products(lang);
        if (cancelled) return;
        if (data?.success) {
          setCategories((data.categories ?? []) as Category[]);
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
  }, []);

  const openUrl = (href: string, external = false) => {
    if (typeof window !== "undefined" && (window as Window & { electron?: unknown }).electron) {
      if (external) {
        (window as Window & { electron: { openExternal: (url: string) => void } }).electron.openExternal(href);
      } else {
        (window as Window & { electron: { openWindow: (url: string) => void } }).electron.openWindow(href);
      }
      return;
    }

    window.open(href, "_blank", "width=1100,height=820");
  };

  const openCheckout = (productId: string) => {
    if (!canOrder) {
      return;
    }
    navigate({ name: "checkout", productId });
  };

  const openStore = () => {
    openUrl(getApiBaseUrl());
  };

  const allProducts = categories.flatMap((cat) => [
    ...cat.products.map((p) => ({ ...p, categoryName: cat.name })),
    ...cat.children.flatMap((sub) => sub.products.map((p) => ({ ...p, categoryName: sub.name }))),
  ]);

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-6 pb-24 pt-2">
        {!canOrder && (
          <div className="glass border border-(--warning)/30 bg-(--surface-soft) p-4 text-sm text-(--text-muted)">
            {t("shopDesktopOnly")}
          </div>
        )}

        {error ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass animate-pulse h-44" />
            ))}
          </div>
        ) : allProducts.length === 0 ? (
          <div className="glass p-10 text-center">
            <PackageSearch className="mx-auto mb-3 size-10 text-(--text-muted)" />
            <p className="mb-4 text-sm text-(--text-muted)">{t("shopNoProducts")}</p>
            <button
              type="button"
              onClick={openStore}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              <ExternalLink className="size-4" />
              {t("shopOpenStore")}
            </button>
          </div>
        ) : (
          <>
            {categories.map((cat) => {
              const catProducts = [
                ...cat.products,
                ...cat.children.flatMap((sub) => sub.products),
              ];
              if (catProducts.length === 0) return null;
              return (
                <section key={cat.id} className="space-y-3">
                  <h2 className="text-sm font-semibold text-(--text-primary)">{cat.name}</h2>
                  {cat.description && (
                    <p className="text-xs text-(--text-muted)">{cat.description}</p>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {catProducts.map((product) => (
                      <ProductCard key={product.id} product={product} onOrder={openCheckout} disabled={!canOrder} />
                    ))}
                  </div>
                </section>
              );
            })}

            {canOrder && countries.length > 0 && (
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

            <button
              type="button"
              onClick={openStore}
              className="glass glass-hover flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-(--text-secondary)"
            >
              <ExternalLink className="size-4" />
              {t("shopOpenStore")}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function ProductCard({ product, onOrder, disabled }: { product: Product; onOrder: (productId: string) => void; disabled: boolean }) {
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
          onClick={() => onOrder(product.id)}
          disabled={disabled}
          className="btn-primary flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart className="size-3" />
          {t("shopOrderNow")}
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
