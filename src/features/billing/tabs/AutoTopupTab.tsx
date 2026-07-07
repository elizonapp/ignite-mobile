import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Repeat, Trash2 } from "lucide-react";

import { useToast } from "../../../components/Toast";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { formatDate, formatMoney, openExternalUrl } from "../lib";
import type { AutoTopupConfig } from "../../../api/wallet";

export function AutoTopupTab() {
  const { t, lang } = useI18n();
  const { show } = useToast();

  const [configs, setConfigs] = useState<AutoTopupConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("25");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [consent, setConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutoTopupConfig | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.wallet.autoTopupList();
      if (res.success) {
        setConfigs(res.configs ?? []);
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

  const amountNum = Number(amount);
  const dayNum = Number(dayOfMonth);
  const formValid =
    Number.isFinite(amountNum) && amountNum >= 5 && amountNum <= 500 && dayNum >= 1 && dayNum <= 28 && consent;

  const create = async () => {
    if (!formValid) return;
    setIsSaving(true);
    try {
      const res = await api.wallet.autoTopupCreate({
        amount: amountNum,
        dayOfMonth: dayNum,
        acceptTerms: true,
        acceptPrivacy: true,
        acceptExpiry: true,
      });
      if (res.success) {
        if (res.verificationCheckoutUrl) {
          openExternalUrl(res.verificationCheckoutUrl);
          show(t("autoTopupVerifyRedirect"), "info");
        } else {
          show(t("autoTopupCreated"), "success");
        }
        setShowForm(false);
        setConsent(false);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (config: AutoTopupConfig) => {
    setBusyId(config.id);
    try {
      const res = await api.wallet.autoTopupUpdate(config.id, { isActive: !config.isActive });
      if (res.success) {
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
    setBusyId(deleteTarget.id);
    try {
      const res = await api.wallet.autoTopupDelete(deleteTarget.id);
      if (res.success) {
        show(t("autoTopupDeleted"), "success");
        setDeleteTarget(null);
        await load();
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="glass space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
          <Repeat className="size-4 text-(--elizon-primary)" />
          {t("autoTopupTitle")}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
          aria-label={t("refresh")}
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
        </button>
      </div>

      <p className="text-xs text-(--text-muted)">{t("autoTopupDesc")}</p>

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-(--error)/30 p-3 text-sm text-(--error)">
          {error}
        </div>
      ) : isLoading ? (
        <div className="h-14 animate-pulse rounded-[var(--radius-control)] bg-(--surface-soft)" />
      ) : configs.length === 0 ? (
        <p className="text-sm text-(--text-muted)">{t("autoTopupEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {configs.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-[var(--radius-control)] border border-(--border) p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-(--text-primary)">
                  {formatMoney(c.amount, lang)} · {t("autoTopupDayOfMonth").replace("{day}", String(c.dayOfMonth))}
                </p>
                <p className="text-[11px] text-(--text-muted)">
                  {c.nextChargeAt
                    ? `${t("autoTopupNextCharge")}: ${formatDate(c.nextChargeAt, lang)}`
                    : t("autoTopupPendingVerification")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleActive(c)}
                disabled={busyId === c.id}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium disabled:opacity-50",
                  c.isActive ? "bg-(--success)/15 text-(--success)" : "bg-(--surface-soft) text-(--text-muted)",
                )}
              >
                {c.isActive ? t("autoTopupActive") : t("autoTopupPaused")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(c)}
                disabled={busyId === c.id}
                className="shrink-0 rounded-lg p-2 text-(--text-secondary) hover:bg-(--error)/10 hover:text-(--error) disabled:opacity-50"
                aria-label={t("delete")}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-3 rounded-[var(--radius-control)] border border-(--border) p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-(--text-muted)">{t("autoTopupAmount")}</span>
              <input
                type="number"
                min={5}
                max={500}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-(--text-muted)">{t("autoTopupDayLabel")}</span>
              <input
                type="number"
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs text-(--text-secondary)">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--elizon-primary)]"
            />
            <span>{t("autoTopupConsent")}</span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) hover:bg-(--bg-elevated)"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void create()}
              disabled={!formValid || isSaving}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : t("save")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="glass-hover flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-(--border) py-2.5 text-sm text-(--text-secondary)"
        >
          <Plus className="size-4" />
          {t("autoTopupAdd")}
        </button>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t("autoTopupDeleteTitle")}
        description={t("autoTopupDeleteDesc")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        isLoading={busyId === deleteTarget?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
