import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { DesktopOnlyHint } from "../capabilities/CapabilityGuard";
import { CustomerFeatureUnavailable } from "../components/CustomerFeatureUnavailable";
import { Button } from "../components/ui/button";
import { useAuth } from "../components/AuthProvider";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import type { ElizonPlusStatusResponse } from "../api/elizon-plus";
import { openExternalUrl } from "../features/billing/lib";
import { api } from "../lib/api";
import { hideElizonPlusUi } from "../lib/elizon-plus";
import { canPurchase } from "../lib/platform";

export function ElizonPlusScreen() {
  const { t, lang } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const { show } = useToast();
  const [status, setStatus] = useState<ElizonPlusStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [savingPooling, setSavingPooling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const fmtDate = (value: string | null | undefined) => {
    if (!value) return "–";
    return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US").format(new Date(value));
  };

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.elizonPlus.status();
      setStatus(data);
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setLoading(false);
    }
  }, [show, t]);

  useEffect(() => {
    if (authLoading || hideElizonPlusUi(user)) return;
    void fetchStatus();
  }, [authLoading, fetchStatus, user]);

  const handleSubscribe = async (paymentMethod: "mollie" | "guthaben") => {
    setSubscribing(true);
    try {
      const data = await api.elizonPlus.subscribe(paymentMethod);
      if (data.success && data.checkoutUrl) {
        await openExternalUrl(data.checkoutUrl);
        return;
      }
      show(resolveApiError(data, t, { fallbackKey: "elizonPlusSubscribeFailed" }), "error");
    } catch (err) {
      show(resolveCaughtApiError(err, t, "elizonPlusNetworkError"), "error");
    } finally {
      setSubscribing(false);
    }
  };

  const handleReactivate = async () => {
    try {
      const data = await api.elizonPlus.reactivate();
      if (data.success) {
        show(t("elizonPlusReactivateSuccess"), "success");
        void fetchStatus();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "elizonPlusReactivateFailed" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t, "elizonPlusNetworkError"), "error");
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const data = await api.elizonPlus.cancel();
      if (data.success) {
        show(t("elizonPlusCancelSuccess"), "success");
        setCancelOpen(false);
        void fetchStatus();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "elizonPlusCancelFailed" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t, "elizonPlusNetworkError"), "error");
    } finally {
      setCanceling(false);
    }
  };

  const updatePooling = async (enabled: boolean) => {
    setSavingPooling(true);
    try {
      const data = await api.elizonPlus.updatePooling(enabled);
      if (data.success) {
        show(t("elizonPlusPoolingSaved"), "success");
        void fetchStatus();
      } else {
        show(t("elizonPlusPoolingSaveFailed"), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t, "elizonPlusNetworkError"), "error");
    } finally {
      setSavingPooling(false);
    }
  };

  if (!authLoading && hideElizonPlusUi(user)) {
    return <CustomerFeatureUnavailable />;
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-(--text-muted)" />
      </div>
    );
  }

  const sub = status?.subscription;
  const active = status?.elizonPlusActive ?? false;
  const isAdminGrant = status?.isAdminGrant ?? user?.role === "ADMIN";

  return (
    <div className="mx-auto mt-8 w-full max-w-screen space-y-4 pb-24 lg:max-w-6xl">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-(--primary)" />
        <div>
          <h1 className="text-base font-semibold text-(--text-primary)">{t("dashboardElizonPlus")}</h1>
          <p className="text-xs text-(--text-muted)">{t("elizonPlusDashboardSubtitle")}</p>
        </div>
      </div>

      {active ? (
        <div className="glass space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-[var(--radius-action)] bg-(--primary)/15 px-2 py-0.5 text-xs font-semibold text-(--primary)">
                {t("elizonPlusStatusActive")}
              </span>
              {isAdminGrant && (
                <span className="ml-2 inline-flex items-center rounded-[var(--radius-action)] bg-(--warning)/15 px-2 py-0.5 text-xs font-semibold text-(--warning)">
                  {t("elizonPlusStatusAdminGrant")}
                </span>
              )}
              <div className="text-sm text-(--text-secondary)">
                {sub?.cancelAtPeriodEnd ? (
                  <p>
                    {t("elizonPlusExpiresAt")} <strong>{fmtDate(sub?.currentPeriodEnd)}</strong>
                    <span className="ml-2 text-xs text-(--warning)">{t("elizonPlusStatusCancelPending")}</span>
                  </p>
                ) : (
                  <p>
                    {t("elizonPlusRenewsAt")} <strong>{fmtDate(sub?.currentPeriodEnd)}</strong>
                  </p>
                )}
                {sub && !sub.isAdminGrant && !sub.cancelAtPeriodEnd && (
                  <p className="text-xs text-(--text-muted)">
                    {t("elizonPlusNextCharge")}: <strong>{sub.basePriceGross.toFixed(2)} €</strong>
                  </p>
                )}
              </div>
            </div>
            {sub && !sub.cancelAtPeriodEnd && !isAdminGrant && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                {t("elizonPlusCancelBtn")}
              </Button>
            )}
            {sub?.cancelAtPeriodEnd && (
              <Button variant="outline" onClick={() => void handleReactivate()}>
                {t("elizonPlusReactivateBtn")}
              </Button>
            )}
          </div>

          <div className="rounded-[var(--radius-surface)] border border-(--border) bg-(--bg-elevated) p-3">
            <h2 className="text-sm font-semibold text-(--text-primary)">{t("elizonPlusSavingsTitle")}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-control)] border border-(--border) p-2">
                <p className="text-[10px] uppercase tracking-wide text-(--text-muted)">{t("elizonPlusSavingsCurrent")}</p>
                <p className="text-lg font-bold text-(--success)">{(status?.savings?.currentPeriodGross ?? 0).toFixed(2)} €</p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-(--border) p-2">
                <p className="text-[10px] uppercase tracking-wide text-(--text-muted)">{t("elizonPlusSavingsLifetime")}</p>
                <p className="text-lg font-bold text-(--success)">{(status?.savings?.lifetimeGross ?? 0).toFixed(2)} €</p>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-surface)] border border-(--border) bg-(--bg-elevated) p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-(--text-primary)">{t("trafficPoolingTitle")}</h2>
              <label className="inline-flex items-center gap-2 text-xs text-(--text-secondary)">
                <input
                  type="checkbox"
                  checked={!!status?.pooling?.enabled}
                  onChange={(e) => void updatePooling(e.target.checked)}
                  disabled={savingPooling}
                />
                {t("active")}
              </label>
            </div>
            <p className="text-xs text-(--text-muted)">{t("trafficPoolingDescription")}</p>
            {(status?.pooling?.pools ?? []).length === 0 ? (
              <p className="text-xs text-(--text-muted)">{t("elizonPlusNoActivePools")}</p>
            ) : (
              (status?.pooling?.pools ?? []).map((pool) => (
                <div key={pool.key} className="rounded-[var(--radius-control)] border border-(--border) p-2 text-xs">
                  <p className="font-semibold text-(--text-primary)">{pool.categoryName ?? pool.categoryId}</p>
                  <p className="text-(--text-muted)">
                    {pool.memberCount} {t("tabServers")} · {pool.usedTb.toFixed(2)} / {pool.includedTb.toFixed(2)} TB
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : canPurchase() ? (
        <div className="glass space-y-4 p-6 text-center">
          <h2 className="text-lg font-semibold text-(--text-primary)">{t("elizonPlusMembershipJoin")}</h2>
          <p className="text-sm text-(--text-muted)">{t("elizonPlusMembershipDesc")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled={subscribing} onClick={() => void handleSubscribe("mollie")}>
              {subscribing ? t("elizonPlusSubscribing") : t("elizonPlusActivate")}
            </Button>
            <Button variant="outline" disabled={subscribing} onClick={() => void handleSubscribe("guthaben")}>
              {t("elizonPlusPayWithWallet")}
            </Button>
          </div>
        </div>
      ) : (
        <DesktopOnlyHint capability="purchase" />
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="glass w-full max-w-md space-y-4 p-4">
            <h3 className="text-base font-semibold text-(--text-primary)">{t("elizonPlusCancelConfirmTitle")}</h3>
            <p className="text-sm text-(--text-muted)">{t("elizonPlusCancelConfirmMessage")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" disabled={canceling} onClick={() => void handleCancel()}>
                {canceling ? t("elizonPlusSubscribing") : t("elizonPlusCancelConfirmBtn")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
