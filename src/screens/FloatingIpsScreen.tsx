import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Loader2, Plus, RefreshCw } from "lucide-react";

import { CapabilityGuard } from "../capabilities/CapabilityGuard";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { formatResourceStatus } from "../i18n/format-status";
import { api } from "../lib/api";
import { canPurchase } from "../lib/platform";
import { cn } from "../lib/utils";
import type { FloatingIp, FloatingIpLocationOffer } from "../api/floating-ips";
import { formatMoney, openExternalUrl } from "../features/billing/lib";

export function FloatingIpsScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const [items, setItems] = useState<FloatingIp[]>([]);
  const [locations, setLocations] = useState<FloatingIpLocationOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [orderLocationId, setOrderLocationId] = useState("");
  const [orderVersion, setOrderVersion] = useState<4 | 6>(4);
  const [isOrdering, setIsOrdering] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listRes, optionsRes] = await Promise.all([api.floatingIps.list(), api.floatingIps.options()]);
      if (listRes.success) {
        setItems(listRes.floatingIps ?? []);
        setError(null);
      } else {
        setError(resolveApiError(listRes, t, { fallbackKey: "floatingIpLoadError" }));
      }
      if (optionsRes.success) {
        setLocations(optionsRes.locations ?? []);
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t, "floatingIpLoadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthlyTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.monthlyPrice ?? 0), 0),
    [items],
  );

  const selectedOffer = useMemo(() => {
    const loc = locations.find((l) => l.id === orderLocationId);
    if (!loc) return null;
    return orderVersion === 4 ? loc.ipv4 : loc.ipv6;
  }, [locations, orderLocationId, orderVersion]);

  const handleOrder = async () => {
    if (!orderLocationId || !selectedOffer?.available) return;
    setIsOrdering(true);
    try {
      const res = await api.floatingIps.order({
        locationId: orderLocationId,
        ipVersion: orderVersion,
        billingCycle: 30,
        paymentMethod: "guthaben",
      });
      if (res.checkoutUrl) {
        openExternalUrl(res.checkoutUrl);
        show(t("floatingIpOrderRedirect"), "info");
      } else if (res.success) {
        show(t("floatingIpOrderSuccess"), "success");
        setShowOrder(false);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-4 page-fullwidth">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">{t("floatingIpTitle")}</h1>
          <p className="text-sm text-(--text-muted)">{t("floatingIpSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {canPurchase() && (
            <button
              type="button"
              onClick={() => {
                const first = locations[0];
                setOrderLocationId(first?.id ?? "");
                setOrderVersion(first?.ipv4?.available ? 4 : 6);
                setShowOrder(true);
              }}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium"
            >
              <Plus className="size-3.5" />
              {t("floatingIpOrder")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            aria-label={t("refresh")}
            className="rounded-xl p-2 text-(--text-muted) hover:bg-(--surface-soft)"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {!isLoading && items.length > 0 && (
        <div className="glass flex items-center justify-between p-4 text-sm">
          <span className="text-(--text-secondary)">{t("floatingIpMonthlyTotal")}</span>
          <span className="font-semibold text-(--text-primary)">{formatMoney(monthlyTotal, lang)}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-(--text-muted)" />
        </div>
      ) : error ? (
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>
      ) : items.length === 0 ? (
        <div className="glass p-8 text-center text-sm text-(--text-muted)">{t("floatingIpEmpty")}</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <section key={item.id} className="glass flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                <Globe className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-mono text-sm font-medium text-(--text-primary)">{item.address}</p>
                <p className="text-xs text-(--text-muted)">
                  {item.locationName} · {item.ipVersion === 4 ? t("ipv4Label") : t("ipv6Label")}
                </p>
                {item.assignedServiceName && (
                  <p className="text-xs text-(--text-secondary)">
                    {t("floatingIpAssignedTo")}: {item.assignedServiceName}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    item.status === "ASSIGNED"
                      ? "bg-(--success)/15 text-(--success)"
                      : "bg-(--surface-soft) text-(--text-muted)",
                  )}
                >
                  {formatResourceStatus(item.status, t)}
                </span>
                <p className="mt-1 text-xs font-medium text-(--text-primary)">
                  {formatMoney(item.monthlyPrice, lang)}
                </p>
              </div>
            </section>
          ))}
        </div>
      )}

      {showOrder && (
        <CapabilityGuard capability="purchase">
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <button
              type="button"
              aria-label={t("cancel")}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowOrder(false)}
            />
            <div className="glass-overlay relative z-10 w-full max-w-md space-y-4 rounded-xl border border-(--border) p-5">
              <h2 className="text-lg font-semibold text-(--text-primary)">{t("floatingIpOrder")}</h2>
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs text-(--text-muted)">{t("floatingIpLocation")}</span>
                  <select
                    value={orderLocationId}
                    onChange={(e) => setOrderLocationId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.city || loc.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  {([4, 6] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOrderVersion(v)}
                      className={cn(
                        "flex-1 rounded-xl border py-2 text-sm font-medium",
                        orderVersion === v
                          ? "border-(--primary) bg-(--primary)/10 text-(--primary)"
                          : "border-(--border) text-(--text-muted)",
                      )}
                    >
                      {v === 4 ? t("ipv4Label") : t("ipv6Label")}
                    </button>
                  ))}
                </div>
                {selectedOffer && (
                  <p className="text-sm text-(--text-secondary)">
                    {formatMoney(selectedOffer.monthlyPrice, lang)} / {t("cycleMonthly")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOrder(false)}
                  className="flex-1 rounded-xl border border-(--border) py-2.5 text-sm"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleOrder()}
                  disabled={isOrdering || !selectedOffer?.available}
                  className="btn-primary flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm disabled:opacity-50"
                >
                  {isOrdering ? <Loader2 className="size-4 animate-spin" /> : t("floatingIpOrderConfirm")}
                </button>
              </div>
            </div>
          </div>
        </CapabilityGuard>
      )}
    </div>
  );
}
