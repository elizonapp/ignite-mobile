import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Plus, Star, Trash2 } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { ApiError, api } from "../../../lib/api";
import { getApiBaseUrl } from "../../../lib/config";
import { isMobileNative } from "../../../lib/platform";
import { canManageSavedPaymentMethodsUser } from "../../../lib/saved-payment-methods";
import { cn } from "../../../lib/utils";
import { openExternalUrl } from "../lib";
import type { SavedPaymentMethod } from "../../../api/billing";

function paymentMethodDisplayLabel(m: SavedPaymentMethod, fallback: string): string {
  return m.userLabel?.trim() || m.label?.trim() || m.brand?.trim() || m.method?.trim() || fallback;
}

function paymentMethodsManageUrl(): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  return `${base}/dashboard/settings?tab=payment-methods`;
}

export function PaymentMethodsTab() {
  const { t } = useI18n();
  const { show } = useToast();
  const { user } = useAuth();

  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [defaultMandateId, setDefaultMandateId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(true);
  const [canAddMore, setCanAddMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedPaymentMethod | null>(null);

  const accountEligible = canManageSavedPaymentMethodsUser(user);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.billing.paymentMethods();
      if (res.success) {
        setMethods(res.methods ?? []);
        setDefaultMandateId(res.defaultMandateId ?? null);
        setCanManage(res.canManage !== false);
        setCanAddMore(res.canAddMore !== false);
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

  const openAddInBrowser = () => {
    openExternalUrl(paymentMethodsManageUrl());
    show(t("paymentMethodAddRedirect"), "info");
  };

  const addMethod = async () => {
    setIsAdding(true);
    try {
      const res = await api.billing.addPaymentMethod();
      if (res.success && res.checkoutUrl) {
        openExternalUrl(res.checkoutUrl);
        show(t("paymentMethodAddRedirect"), "info");
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "clientPlatformNotAllowed") {
        openAddInBrowser();
      } else {
        show(resolveCaughtApiError(err, t), "error");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const setDefault = async (m: SavedPaymentMethod) => {
    setBusyId(m.mandateId);
    try {
      const res = await api.billing.setDefaultPaymentMethod(m.mandateId);
      if (res.success) {
        show(t("paymentMethodDefaultSet"), "success");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.mandateId);
    try {
      const res = await api.billing.deletePaymentMethod(deleteTarget.mandateId);
      if (res.success) {
        show(t("paymentMethodDeleted"), "success");
        setDeleteTarget(null);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyId(null);
    }
  };

  const blockedMessage = (() => {
    if (accountEligible) return null;
    if (user?.familyRole === "MINOR" && user.familyGroupId) {
      return t("familyMinorPaymentMethodsBlocked");
    }
    if ((user?.accountType ?? "").toUpperCase() === "BUSINESS") {
      return t("businessPaymentMethodsDisabled");
    }
    return t("paymentMethodsUnavailable");
  })();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>;
  }

  if (!canManage && methods.length === 0) {
    return (
      <div className="glass space-y-2 p-6 text-center text-sm text-(--text-muted)">
        <p>{blockedMessage ?? t("paymentMethodsUnavailable")}</p>
      </div>
    );
  }

  const addDisabled = isAdding || !canAddMore || !canManage;

  return (
    <div className="space-y-3">
      {isMobileNative() && (
        <p className="text-xs text-(--text-muted)">{t("paymentMethodMobileAddHint")}</p>
      )}

      {methods.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("paymentMethodsEmpty")}</div>
      ) : (
        methods.map((m) => {
          const isDefault = m.mandateId === defaultMandateId || m.isDefault;
          return (
            <div key={m.mandateId} className="glass flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                <CreditCard className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">
                  {paymentMethodDisplayLabel(m, t("paymentMethod"))}
                  {m.last4 ? ` •••• ${m.last4}` : ""}
                </p>
                {isDefault && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-(--elizon-primary)">
                    <Star className="size-3 fill-current" />
                    {t("paymentMethodDefault")}
                  </span>
                )}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => void setDefault(m)}
                      disabled={busyId === m.mandateId}
                      className="rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-elevated) hover:text-(--elizon-primary) disabled:opacity-50"
                      aria-label={t("paymentMethodMakeDefault")}
                      title={t("paymentMethodMakeDefault")}
                    >
                      <Star className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(m)}
                    disabled={busyId === m.mandateId}
                    className="rounded-lg p-2 text-(--text-secondary) hover:bg-(--error)/10 hover:text-(--error) disabled:opacity-50"
                    aria-label={t("delete")}
                    title={t("delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {canManage && (
        <button
          type="button"
          onClick={() => void addMethod()}
          disabled={addDisabled}
          className={cn(
            "glass glass-hover flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-(--text-primary) disabled:opacity-50",
          )}
        >
          {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {canAddMore ? t("paymentMethodAdd") : t("paymentMethodLimitReached")}
        </button>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t("paymentMethodDeleteTitle")}
        description={t("paymentMethodDeleteDesc")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        isLoading={busyId === deleteTarget?.mandateId}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
