import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Server } from "lucide-react";

import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { CancellationModal } from "../components/CancellationModal";
import { formatDate, formatMoney } from "../lib";
import type { Subscription } from "../types";

const cycleLabelKey: Record<number, string> = {
  7: "cycleWeekly",
  14: "cycle2Weekly",
  30: "cycleMonthly",
  60: "cycle2Monthly",
  90: "cycleQuarterly",
  120: "cycle4Monthly",
  365: "cycleYearly",
};

export function SubscriptionsTab() {
  const { t, lang } = useI18n();
  const { show } = useToast();

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [immediate, setImmediate] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.billing.subscriptions();
      if (res.success) {
        setSubs((res.subscriptions ?? []) as Subscription[]);
        setError(null);
      } else {
        setError(resolveApiError(res, t, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const reactivate = async (sub: Subscription) => {
    if (!sub.service?.id) return;
    setIsBusy(true);
    try {
      const res = await api.services.subscriptionReactivate(sub.service.id);
      if (res.success) {
        show(t("subscriptionReactivatedToast"), "success");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget?.service?.id) return;
    setIsBusy(true);
    try {
      const res = await api.services.subscriptionCancel(cancelTarget.service.id, immediate);
      if (res.success) {
        show(immediate ? t("subscriptionCanceledNowToast") : t("subscriptionCancelScheduledToast"), "success");
        setCancelTarget(null);
        setImmediate(false);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
        <div className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="text-(--text-secondary) hover:text-(--text-primary)">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (subs.length === 0) {
    return <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("subscriptionsEmpty")}</div>;
  }

  return (
    <div className="space-y-3">
      {subs.map((sub) => {
        const pendingCancel = sub.cancelAtPeriodEnd && sub.status === "ACTIVE";
        const cycleKey = cycleLabelKey[sub.billingCycleDays];
        return (
          <div key={sub.id} className="glass space-y-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                <Server className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">
                  {sub.service?.name ?? sub.product?.name ?? t("subscription")}
                </p>
                <p className="text-xs text-(--text-muted)">
                  {cycleKey ? t(cycleKey as never) : `${sub.billingCycleDays} ${t("days")}`}
                  {sub.product?.priceMonthly != null && ` · ${formatMoney(sub.product.priceMonthly, lang)}`}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  pendingCancel
                    ? "bg-(--warning)/15 text-(--warning)"
                    : sub.status === "ACTIVE"
                      ? "bg-(--success)/15 text-(--success)"
                      : "bg-(--surface-soft) text-(--text-muted)",
                )}
              >
                {pendingCancel ? t("subscriptionEndingSoon") : sub.status}
              </span>
            </div>

            {sub.currentPeriodEnd && (
              <p className="text-xs text-(--text-muted)">
                {pendingCancel ? t("subscriptionEndsOn") : t("subscriptionRenewsOn")}: {formatDate(sub.currentPeriodEnd, lang)}
              </p>
            )}

            {sub.service?.id && (
              <div className="flex justify-end gap-2">
                {pendingCancel ? (
                  <button
                    type="button"
                    onClick={() => void reactivate(sub)}
                    disabled={isBusy}
                    className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" />
                    {t("subscriptionReactivate")}
                  </button>
                ) : (
                  sub.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setImmediate(false);
                        setCancelTarget(sub);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-(--error)/40 px-3 py-1.5 text-xs font-medium text-(--error) transition-colors hover:bg-(--error)/10"
                    >
                      {t("subscriptionCancel")}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      <CancellationModal
        open={!!cancelTarget}
        title={t("subscriptionCancelTitle")}
        consequences={[
          t("subscriptionCancelConsequenceAccess").replace(
            "{name}",
            cancelTarget?.service?.name ?? cancelTarget?.product?.name ?? "",
          ),
          immediate
            ? t("subscriptionCancelConsequenceImmediate")
            : t("subscriptionCancelConsequencePeriodEnd").replace(
                "{date}",
                cancelTarget?.currentPeriodEnd ? formatDate(cancelTarget.currentPeriodEnd, lang) : "—",
              ),
          t("subscriptionCancelConsequenceData"),
        ]}
        confirmLabel={immediate ? t("subscriptionCancelConfirmNow") : t("subscriptionCancelConfirm")}
        onConfirm={(_feedback) => void confirmCancel()}
        onCancel={() => {
          setCancelTarget(null);
          setImmediate(false);
        }}
        isLoading={isBusy}
        options={
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-control)] border border-(--border) p-3">
            <span className="text-sm text-(--text-primary)">{t("subscriptionCancelImmediateOption")}</span>
            <input
              type="checkbox"
              checked={immediate}
              onChange={(e) => setImmediate(e.target.checked)}
              className="size-4 accent-[var(--error)]"
            />
          </label>
        }
      />
    </div>
  );
}
