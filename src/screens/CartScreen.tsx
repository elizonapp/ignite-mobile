import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useCart } from "../components/cart/CartProvider";
import { useRouter } from "../components/Router";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { CartCalculateResponse } from "../api/checkout";
import { cn } from "../lib/utils";

export function CartScreen() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const { cart, removeItem, updateQuantity, updateBillingCycle } = useCart();
  const [pricing, setPricing] = useState<CartCalculateResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
        style: "currency",
        currency: "EUR",
      }),
    [lang],
  );
  const formatPrice = (value: number) => fmt.format(value);

  const loadPricing = useCallback(async () => {
    if (cart.items.length === 0) {
      setPricing(null);
      return;
    }
    setPricingLoading(true);
    try {
      const res = await api.checkout.calculate({
        items: cart.items.map((item) => ({
          lineId: item.lineId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          billingCycle: item.billingCycle,
          itemType: "new",
        })),
        lang,
      });
      setPricing(res?.success ? res : null);
    } catch {
      setPricing(null);
    } finally {
      setPricingLoading(false);
    }
  }, [cart.items, lang]);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  const pricedItems = pricing?.items ?? [];

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-3xl flex-1 flex-col page-fullwidth">
      <header className="safe-x flex items-center gap-2 pb-4 pt-2">
        <ShoppingCart className="size-5 text-(--elizon-primary)" />
        <div>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("navCart")}</h1>
          <p className="text-xs text-(--text-muted)">
            {cart.items.length === 0
              ? t("navCartEmpty")
              : `${cart.items.reduce((sum, item) => sum + item.quantity, 0)} ${t("checkoutQuantity")}`}
          </p>
        </div>
      </header>

      <main className="safe-x flex-1 space-y-4 pb-24">
        {cart.items.length === 0 ? (
          <div className="glass p-10 text-center">
            <ShoppingCart className="mx-auto mb-3 size-10 text-(--text-muted)" />
            <p className="text-sm text-(--text-muted)">{t("navCartEmpty")}</p>
            <button
              type="button"
              onClick={() => navigate({ name: "shop" })}
              className="btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              {t("tabShop")}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {cart.items.map((item) => {
                const priced = pricedItems.find((entry) => entry.productId === item.productId);
                const cycles: number[] = item.priceYearly != null ? [30, 365] : [30];

                return (
                  <div key={item.lineId} className="glass space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-(--text-primary)">{item.productName}</p>
                        {item.categoryName && (
                          <p className="text-xs text-(--text-muted)">{item.categoryName}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.lineId)}
                        className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error)"
                        aria-label={t("cartRemoveItem")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="grid size-8 place-items-center rounded-lg border border-(--border) text-(--text-secondary) disabled:opacity-40"
                          aria-label={t("checkoutQuantityDecrease")}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold text-(--text-primary)">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                          className="grid size-8 place-items-center rounded-lg border border-(--border) text-(--text-secondary)"
                          aria-label={t("checkoutQuantityIncrease")}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>

                      <select
                        value={item.billingCycle}
                        onChange={(event) =>
                          updateBillingCycle(item.lineId, Number(event.target.value))
                        }
                        className="h-8 rounded-lg border border-(--border) bg-(--bg-elevated) px-2 text-xs text-(--text-primary) focus:outline-none"
                      >
                        {cycles.map((cycle) => (
                          <option key={cycle} value={cycle}>
                            {cycle === 365 ? t("checkoutCycleYearly") : t("checkoutCycleMonthly")}
                          </option>
                        ))}
                      </select>

                      <span className="ml-auto text-sm font-semibold text-(--elizon-primary)">
                        {pricingLoading ? "…" : formatPrice(priced?.total ?? item.priceMonthly * item.quantity)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--text-muted)">{t("checkoutSubtotal")}</span>
                <span className="text-(--text-secondary)">
                  {pricingLoading ? "…" : formatPrice(pricing?.subtotal ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--text-muted)">{pricing?.taxName ?? t("checkoutTax")}</span>
                <span className="text-(--text-secondary)">
                  {pricingLoading ? "…" : formatPrice(pricing?.tax ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-(--border) pt-2 text-base font-bold text-(--text-primary)">
                <span>{t("navCartTotal")}</span>
                <span>{pricingLoading ? "…" : formatPrice(pricing?.total ?? 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ name: "checkout" })}
              disabled={pricingLoading}
              className={cn(
                "btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
                pricingLoading && "opacity-60",
              )}
            >
              {pricingLoading && <Loader2 className="size-4 animate-spin" />}
              {t("cartGoToCheckout")}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
