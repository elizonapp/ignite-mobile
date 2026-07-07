import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
  Wallet,
} from "lucide-react";

import { useAuth } from "../../components/AuthProvider";
import { useRouter } from "../../components/Router";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n";
import { resolveApiError } from "../../api/resolve-error";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { formatDate, formatMoney, invoiceStatusTone, openExternalUrl, toneClasses } from "./lib";
import type { InvoiceDetail } from "./types";
import type { SavedPaymentMethod } from "../../api/billing";

interface InvoicePayScreenProps {
  id: string;
}

type PayMethod = "guthaben" | "mollie_saved" | "mollie";

export function InvoicePayScreen({ id }: InvoicePayScreenProps) {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const { show } = useToast();
  const { user, refresh } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [defaultMandateId, setDefaultMandateId] = useState<string | null>(null);
  const [netPointsMaxEur, setNetPointsMaxEur] = useState(0);

  const [method, setMethod] = useState<PayMethod>("mollie");
  const [selectedMandateId, setSelectedMandateId] = useState<string | null>(null);
  const [useNetPoints, setUseNetPoints] = useState(false);
  const [useBalance, setUseBalance] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [redirected, setRedirected] = useState(false);

  const balance = user?.balance ?? 0;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.billing.invoice(id);
      if (!res.success || !res.invoice) {
        setError(t("invoicePayNotFound"));
        return;
      }
      const inv = res.invoice as InvoiceDetail;
      setInvoice(inv);

      // Payment methods + NetPoints preview are best-effort; failures shouldn't block paying.
      const [methodsRes, npRes] = await Promise.allSettled([
        api.billing.paymentMethods(),
        api.billing.netPointsPreview(inv.total),
      ]);

      if (methodsRes.status === "fulfilled" && methodsRes.value.success) {
        const list = methodsRes.value.methods ?? [];
        setMethods(list);
        setDefaultMandateId(methodsRes.value.defaultMandateId ?? null);
        if (list.length > 0) {
          const def = methodsRes.value.defaultMandateId ?? list[0]?.mandateId ?? null;
          setSelectedMandateId(def);
          setMethod("mollie_saved");
        }
      }
      if (npRes.status === "fulfilled" && npRes.value.success) {
        setNetPointsMaxEur(npRes.value.maxEur ?? 0);
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = invoice?.total ?? 0;
  const alreadyPaid = invoice?.status === "PAID";
  const voided = invoice?.status === "VOIDED";
  const netPointsEur = useNetPoints ? Math.min(netPointsMaxEur, total) : 0;
  const afterNetPoints = Math.max(0, Math.round((total - netPointsEur) * 100) / 100);

  // Balance that will be applied before the card charge (only for card-based methods).
  const balanceApplied = useMemo(() => {
    if (method === "guthaben") return Math.min(balance, afterNetPoints);
    if (!useBalance) return 0;
    return Math.min(balance, afterNetPoints);
  }, [method, useBalance, balance, afterNetPoints]);

  const remaining = Math.max(0, Math.round((afterNetPoints - balanceApplied) * 100) / 100);
  const balanceCoversAll = balance >= afterNetPoints;

  const canPay = useMemo(() => {
    if (isPaying || alreadyPaid || voided) return false;
    if (afterNetPoints <= 0) return true; // fully covered by NetPoints
    if (method === "guthaben") return balanceCoversAll;
    if (method === "mollie_saved") return !!selectedMandateId;
    return true; // mollie
  }, [isPaying, alreadyPaid, voided, afterNetPoints, method, balanceCoversAll, selectedMandateId]);

  const handlePay = async () => {
    if (!invoice || !canPay) return;
    setIsPaying(true);
    try {
      const netPointsRedeemEur = netPointsEur > 0 ? netPointsEur : undefined;
      let res;
      if (method === "guthaben" || afterNetPoints <= 0) {
        res = await api.billing.payInvoice(invoice.id, {
          paymentMethod: "guthaben",
          netPointsRedeemEur,
        });
      } else {
        res = await api.billing.payInvoice(invoice.id, {
          paymentMethod: method,
          savedMandateId: method === "mollie_saved" ? selectedMandateId ?? undefined : undefined,
          amountFromBalance: balanceApplied > 0 ? balanceApplied : undefined,
          netPointsRedeemEur,
        });
      }

      if (res.checkoutUrl) {
        setRedirected(true);
        openExternalUrl(res.checkoutUrl);
        show(t("invoicePayRedirectToast"), "info");
        return;
      }
      if (res.processing) {
        show(t("invoicePayProcessingToast"), "info");
        setRedirected(true);
        return;
      }
      // success / alreadyPaid
      setPaid(true);
      show(t("invoicePaySuccessToast"), "success");
      void refresh();
    } catch (err) {
      show(resolveCaughtApiError(err, t, "invoicePayFailedToast"), "error");
    } finally {
      setIsPaying(false);
    }
  };

  const goBack = () => navigate({ name: "invoices" });

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--text-muted)" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 py-8">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-4" /> {t("backToInvoices")}
        </button>
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
          {error ?? t("invoicePayNotFound")}
        </div>
      </div>
    );
  }

  const tone = invoiceStatusTone(invoice.status);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 py-6 page-fullwidth">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
      >
        <ArrowLeft className="size-4" /> {t("backToInvoices")}
      </button>

      {/* Level 1 — Identity & amount */}
      <section className="glass space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-(--text-primary)">{t("invoicePayTitle")}</h1>
            <p className="mt-0.5 text-sm text-(--text-muted)">{invoice.number ?? invoice.invoiceNumber}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", toneClasses(tone))}>
            {invoice.status}
          </span>
        </div>

        <div className="rounded-[var(--radius-control)] bg-(--surface-soft) p-4 text-center">
          <div className="text-3xl font-bold text-(--text-primary)">{formatMoney(total, lang, invoice.currency)}</div>
          {invoice.dueAt && (
            <p className="mt-1 text-xs text-(--text-muted)">
              {t("invoiceDue")}: {formatDate(invoice.dueAt, lang)}
            </p>
          )}
        </div>

        {invoice.items.length > 0 && (
          <div className="space-y-2">
            {invoice.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-(--text-secondary)">
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}
                  {item.description}
                </span>
                <span className="shrink-0 font-medium text-(--text-primary)">
                  {formatMoney(item.total, lang, invoice.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {alreadyPaid || paid ? (
        <section className="glass flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 className="size-10 text-(--success)" />
          <p className="text-sm text-(--text-primary)">{t("invoiceAlreadyPaidNotice")}</p>
          <button type="button" onClick={goBack} className="btn-primary rounded-xl px-5 py-2.5 text-sm">
            {t("backToInvoices")}
          </button>
        </section>
      ) : voided ? (
        <section className="glass p-6 text-center text-sm text-(--text-muted)">{t("invoiceVoidedNotice")}</section>
      ) : redirected ? (
        <section className="glass flex flex-col items-center gap-3 p-6 text-center">
          <ExternalLink className="size-9 text-(--elizon-primary)" />
          <p className="text-sm text-(--text-primary)">{t("invoicePayRedirectNotice")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="btn-primary rounded-xl px-4 py-2 text-sm">
              {t("invoicePayCheckStatus")}
            </button>
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-(--border) px-4 py-2 text-sm text-(--text-secondary) hover:bg-(--bg-elevated)"
            >
              {t("backToInvoices")}
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Level 2 — Reductions (Guthaben / NetPoints) */}
          {(netPointsMaxEur > 0 || balance > 0) && (
            <section className="glass space-y-3 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">
                {t("invoicePayReductions")}
              </h2>

              {netPointsMaxEur > 0 && (
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-(--text-primary)">
                    <Sparkles className="size-4 text-(--elizon-primary)" />
                    {t("invoicePayUseNetPoints")}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-(--success)">
                      −{formatMoney(Math.min(netPointsMaxEur, total), lang, invoice.currency)}
                    </span>
                    <input
                      type="checkbox"
                      checked={useNetPoints}
                      onChange={(e) => setUseNetPoints(e.target.checked)}
                      className="size-4 accent-[var(--elizon-primary)]"
                    />
                  </span>
                </label>
              )}

              {balance > 0 && method !== "guthaben" && (
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-(--text-primary)">
                    <Wallet className="size-4 text-(--elizon-primary)" />
                    {t("invoicePayUseBalance")}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-(--text-muted)">
                      {t("billingBalance")}: {formatMoney(balance, lang)}
                    </span>
                    <input
                      type="checkbox"
                      checked={useBalance}
                      onChange={(e) => setUseBalance(e.target.checked)}
                      className="size-4 accent-[var(--elizon-primary)]"
                    />
                  </span>
                </label>
              )}
            </section>
          )}

          {/* Level 2 — Payment method for the remaining amount */}
          {afterNetPoints > 0 && (
            <section className="glass space-y-2 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">
                {t("invoicePayMethod")}
              </h2>

              {balance > 0 && (
                <MethodOption
                  icon={<Wallet className="size-4" />}
                  active={method === "guthaben"}
                  disabled={!balanceCoversAll}
                  onSelect={() => setMethod("guthaben")}
                  title={t("invoicePayMethodBalance")}
                  subtitle={
                    balanceCoversAll
                      ? `${t("billingBalance")}: ${formatMoney(balance, lang)}`
                      : t("invoicePayBalanceInsufficient")
                  }
                />
              )}

              {methods.length > 0 && (
                <MethodOption
                  icon={<CreditCard className="size-4" />}
                  active={method === "mollie_saved"}
                  onSelect={() => setMethod("mollie_saved")}
                  title={t("invoicePayMethodSaved")}
                  subtitle={t("invoicePayMethodSavedHint")}
                >
                  {method === "mollie_saved" && (
                    <div className="mt-2 space-y-1.5">
                      {methods.map((m) => (
                        <button
                          key={m.mandateId}
                          type="button"
                          onClick={() => setSelectedMandateId(m.mandateId)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-[var(--radius-control)] border px-3 py-2 text-sm",
                            selectedMandateId === m.mandateId
                              ? "border-(--primary) bg-(--primary)/10 text-(--text-primary)"
                              : "border-(--border) text-(--text-secondary) hover:bg-(--bg-elevated)",
                          )}
                        >
                          <span className="truncate">
                            {m.userLabel || m.label || m.brand || m.method || t("invoicePayMethodSaved")}
                            {m.last4 ? ` •••• ${m.last4}` : ""}
                          </span>
                          {m.mandateId === defaultMandateId && (
                            <span className="text-[10px] uppercase tracking-wide text-(--text-muted)">
                              {t("paymentMethodDefault")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </MethodOption>
              )}

              <MethodOption
                icon={<CreditCard className="size-4" />}
                active={method === "mollie"}
                onSelect={() => setMethod("mollie")}
                title={t("invoicePayMethodCard")}
                subtitle={t("invoicePayMethodCardHint")}
              />
            </section>
          )}

          {/* Breakdown + submit */}
          <section className="glass space-y-3 p-5">
            <div className="space-y-1.5 text-sm">
              <Row label={t("invoicePayAmountDue")} value={formatMoney(total, lang, invoice.currency)} />
              {netPointsEur > 0 && (
                <Row
                  label={t("invoicePayUseNetPoints")}
                  value={`−${formatMoney(netPointsEur, lang, invoice.currency)}`}
                  tone="success"
                />
              )}
              {balanceApplied > 0 && (
                <Row
                  label={t("invoicePayUseBalance")}
                  value={`−${formatMoney(balanceApplied, lang, invoice.currency)}`}
                  tone="success"
                />
              )}
              <div className="my-1 border-t border-(--border)" />
              <Row
                label={method === "guthaben" || afterNetPoints <= 0 ? t("invoicePayTotalDue") : t("invoicePayCardCharge")}
                value={formatMoney(remaining, lang, invoice.currency)}
                strong
              />
            </div>

            <button
              type="button"
              onClick={() => void handlePay()}
              disabled={!canPay}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : method === "mollie" && remaining > 0 ? (
                <>
                  <ExternalLink className="size-4" />
                  {t("invoicePayNowExternal")}
                </>
              ) : (
                t("invoicePayNow")
              )}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function MethodOption({
  icon,
  title,
  subtitle,
  active,
  disabled,
  onSelect,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-control)] border p-3 transition-colors",
        active ? "border-(--primary) bg-(--primary)/5" : "border-(--border)",
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onSelect}
        disabled={disabled}
        className="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            active ? "bg-(--primary)/15 text-(--elizon-primary)" : "bg-(--surface-soft) text-(--text-muted)",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-(--text-primary)">{title}</span>
          {subtitle && <span className="block text-xs text-(--text-muted)">{subtitle}</span>}
        </span>
        <span
          className={cn(
            "size-4 shrink-0 rounded-full border-2",
            active ? "border-(--primary) bg-(--primary)" : "border-(--border)",
          )}
        />
      </button>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-(--text-secondary)", strong && "font-medium text-(--text-primary)")}>{label}</span>
      <span
        className={cn(
          strong ? "text-base font-semibold text-(--text-primary)" : "text-(--text-primary)",
          tone === "success" && "text-(--success)",
        )}
      >
        {value}
      </span>
    </div>
  );
}
