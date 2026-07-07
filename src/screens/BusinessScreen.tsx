import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Clock, CreditCard, Loader2, Wallet, XCircle } from "lucide-react";

import { useAuth } from "../components/AuthProvider";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { canPurchase } from "../lib/platform";
import { cn } from "../lib/utils";
import type {
  BusinessBillingConfig,
  BusinessFundContract,
  BusinessFundOffer,
  BusinessVerificationRecord,
} from "../api/business";
import { CancellationModal } from "../features/billing/components/CancellationModal";
import { formatDate, formatMoney, openExternalUrl } from "../features/billing/lib";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

type BillingConfig = {
  invoiceEnabled: boolean;
  hasActiveFund: boolean;
  anchorDay: number | null;
  currentCycleStart: string | null;
  currentCycleEnd: string | null;
  openAmount: number;
  nextInvoiceDate: string | null;
};

function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function mapVerificationStatus(status?: string | null): VerificationStatus {
  switch ((status ?? "NONE").toUpperCase()) {
    case "VERIFIED":
      return "verified";
    case "PENDING":
      return "pending";
    case "REJECTED":
      return "rejected";
    default:
      return "unverified";
  }
}

function mapBillingConfig(config: BusinessBillingConfig | null | undefined): BillingConfig | null {
  if (!config) return null;
  return {
    invoiceEnabled: parseBooleanFlag(config.invoiceEnabled),
    hasActiveFund: parseBooleanFlag(config.hasActiveFund),
    anchorDay: config.billingAnchorDay ?? null,
    currentCycleStart: config.currentCycle?.periodStart ?? null,
    currentCycleEnd: config.currentCycle?.periodEnd ?? null,
    openAmount: Number(config.openAmount ?? 0),
    nextInvoiceDate: config.nextInvoiceDate ?? null,
  };
}

const statusIcon: Record<VerificationStatus, typeof CheckCircle> = {
  verified: CheckCircle,
  pending: Clock,
  rejected: XCircle,
  unverified: XCircle,
};

const statusColor: Record<VerificationStatus, string> = {
  verified: "text-(--success)",
  pending: "text-(--warning)",
  rejected: "text-(--error)",
  unverified: "text-(--text-muted)",
};

export function BusinessScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { refresh } = useAuth();
  const purchaseAllowed = canPurchase();

  const [verification, setVerification] = useState<BusinessVerificationRecord | null>(null);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [eligible, setEligible] = useState(true);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);
  const [contract, setContract] = useState<BusinessFundContract | null>(null);
  const [offer, setOffer] = useState<BusinessFundOffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showFundRequest, setShowFundRequest] = useState(false);
  const [selectedAnchorDay, setSelectedAnchorDay] = useState<1 | 14>(1);
  const [fundRequestAmount, setFundRequestAmount] = useState("");
  const [fundRequestBinding, setFundRequestBinding] = useState("12");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [eligibilityRes, verificationRes, billingRes, fundRes] = await Promise.all([
        api.business.eligibility().catch(() => null),
        api.business.verification().catch(() => null),
        api.business.billing().catch(() => null),
        api.business.fund().catch(() => null),
      ]);

      if (eligibilityRes?.success) {
        setEligible(eligibilityRes.eligible);
        setEligibilityReason(eligibilityRes.reason ?? null);
      }

      if (verificationRes?.success) {
        setVerification(verificationRes.verification);
      }

      if (billingRes?.success) {
        const mapped = mapBillingConfig(billingRes.config);
        setBilling(mapped);
        if (mapped?.anchorDay === 1 || mapped?.anchorDay === 14) {
          setSelectedAnchorDay(mapped.anchorDay);
        }
      }

      if (fundRes?.success) {
        setContract(fundRes.contract);
        setOffer(fundRes.pendingOffer);
      }

      const anySuccess =
        eligibilityRes?.success ||
        verificationRes?.success ||
        billingRes?.success ||
        fundRes?.success;

      if (!anySuccess) {
        setError(t("businessNoData"));
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

  const acceptFund = async (paymentMethod: "mollie" | "guthaben") => {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await api.business.acceptFund(offer.id, paymentMethod);
      if (res.success) {
        if (res.checkoutUrl) {
          openExternalUrl(res.checkoutUrl);
          show(t("businessFundAcceptRedirect"), "info");
        } else {
          show(t("businessFundAccepted"), "success");
          void refresh();
        }
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const rejectFund = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await api.business.rejectFund(offer.id);
      if (res.success) {
        show(t("businessFundRejected"), "success");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const requestFund = async () => {
    const amount = Number(fundRequestAmount);
    const bindingMonths = Number(fundRequestBinding);
    if (!Number.isFinite(amount) || amount < 25) return;
    setBusy(true);
    try {
      const res = await api.business.requestFund(amount, bindingMonths);
      if (res.success) {
        show(t("businessFundRequestSuccess"), "success");
        setShowFundRequest(false);
        setFundRequestAmount("");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const enableInvoice = async () => {
    setBusy(true);
    try {
      const res = await api.business.enableInvoiceBilling(selectedAnchorDay);
      if (res.success) {
        show(t("businessEnableInvoiceSuccess"), "success");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const disableInvoice = async () => {
    setBusy(true);
    try {
      const res = await api.business.disableInvoiceBilling();
      if (res.success) {
        show(t("businessDisableInvoiceSuccess"), "success");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmCancelFund = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      const res = await api.business.cancelFund(contract.id);
      if (res.success) {
        show(t("businessFundCanceled"), "success");
        setShowCancel(false);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return t("na");
    return formatDate(iso, lang);
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center py-16 page-fullwidth">
        <Loader2 className="size-6 animate-spin text-(--text-muted)" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 page-fullwidth">
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
          {error}
          <button type="button" onClick={() => void load()} className="ml-2 text-xs underline">
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const verStatus = mapVerificationStatus(verification?.status);
  const Icon = statusIcon[verStatus];
  const isVerified = verStatus === "verified";
  const inBindingPeriod = !!contract?.bindingEndDate && new Date(contract.bindingEndDate) > new Date();
  const fundRequestValid = Number(fundRequestAmount) >= 25;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-4 page-fullwidth">
      <div>
        <h1 className="text-2xl font-semibold text-(--text-primary)">{t("businessTitle")}</h1>
        <p className="text-sm text-(--text-muted)">{t("businessSubtitle")}</p>
      </div>

      {!eligible && eligibilityReason && (
        <div className="glass border border-(--warning)/30 p-4 text-sm text-(--warning)">
          {eligibilityReason}
        </div>
      )}

      <section className="glass space-y-3 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("businessVerification")}</h2>
        <div className="flex items-center gap-3">
          <Icon className={cn("size-6 shrink-0", statusColor[verStatus])} />
          <div>
            <p className="text-sm font-medium text-(--text-primary)">
              {t(
                verStatus === "verified"
                  ? "businessVerified"
                  : verStatus === "pending"
                    ? "businessPending"
                    : verStatus === "rejected"
                      ? "businessRejected"
                      : "businessUnverified",
              )}
            </p>
            {verification?.adminComment && (
              <p className="mt-0.5 text-xs text-(--text-muted)">{verification.adminComment}</p>
            )}
          </div>
        </div>
      </section>

      {isVerified && billing && (
        <section className="glass space-y-4 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("businessBillingMode")}</h2>
          <Row
            label={t("businessBillingModeLabel")}
            value={billing.invoiceEnabled ? t("businessBillingModeInvoice") : t("businessBillingModeStandard")}
          />

          {billing.invoiceEnabled ? (
            <>
              <Row label={t("businessOpenAmount")} value={formatMoney(billing.openAmount, lang)} />
              {billing.nextInvoiceDate && (
                <Row label={t("businessNextInvoice")} value={fmtDate(billing.nextInvoiceDate)} />
              )}
              {billing.currentCycleStart && billing.currentCycleEnd && (
                <Row
                  label={t("businessCurrentCycle")}
                  value={`${fmtDate(billing.currentCycleStart)} – ${fmtDate(billing.currentCycleEnd)}`}
                />
              )}
              {billing.anchorDay != null && (
                <Row label={t("businessAnchorDay")} value={String(billing.anchorDay)} />
              )}
              <button
                type="button"
                onClick={() => void disableInvoice()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-(--error)/40 px-4 py-2 text-sm font-medium text-(--error) hover:bg-(--error)/10 disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("businessDisableInvoiceBtn")}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-(--text-secondary)">{t("businessEnableInvoiceDesc")}</p>
              <div>
                <p className="mb-2 text-xs font-medium text-(--text-secondary)">{t("businessAnchorDay")}</p>
                <div className="flex gap-2">
                  {([1, 14] as const).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedAnchorDay(day)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        selectedAnchorDay === day
                          ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--elizon-primary)"
                          : "border-(--border) text-(--text-secondary) hover:border-(--elizon-primary)/50",
                      )}
                    >
                      {day === 1 ? t("businessAnchorDay1") : t("businessAnchorDay14")}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void enableInvoice()}
                disabled={busy}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("businessEnableInvoiceBtn")}
              </button>
            </div>
          )}
        </section>
      )}

      {isVerified && (
        <section className="glass space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("businessFund")}</h2>
            {!contract && (
              <button
                type="button"
                onClick={() => setShowFundRequest(true)}
                className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                {t("businessFundRequest")}
              </button>
            )}
          </div>
          <p className="text-sm text-(--text-secondary)">{t("businessFundDesc")}</p>

          {offer && (
            <div className="space-y-3 rounded-[var(--radius-control)] border border-(--border) p-3">
              <p className="text-sm font-medium text-(--text-primary)">{t("businessFundOfferTitle")}</p>
              <Row label={t("businessFundCommitment")} value={formatMoney(offer.commitmentAmount, lang)} />
              <Row label={t("businessFundPrice")} value={formatMoney(offer.price, lang)} />
              <Row label={t("businessFundOvercharge")} value={`${offer.overchargeFeePercent}%`} />
              <Row label={t("businessFundBinding")} value={`${offer.bindingMonths} ${t("months")}`} />
              {offer.adminNote && <p className="text-xs text-(--text-muted)">{offer.adminNote}</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                {purchaseAllowed && (
                  <button
                    type="button"
                    onClick={() => void acceptFund("mollie")}
                    disabled={busy}
                    className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {t("businessFundAcceptCard")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void acceptFund("guthaben")}
                  disabled={busy}
                  className="glass glass-hover inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm disabled:opacity-50"
                >
                  <Wallet className="size-4" />
                  {t("businessFundAcceptBalance")}
                </button>
                <button
                  type="button"
                  onClick={() => void rejectFund()}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-(--error)/40 py-2 text-sm font-medium text-(--error) hover:bg-(--error)/10 disabled:opacity-50"
                >
                  {t("businessFundRejectOffer")}
                </button>
              </div>
            </div>
          )}

          {contract?.status === "ACTIVE" ? (
            <div className="space-y-2">
              <Row label={t("businessFundCommitment")} value={formatMoney(contract.commitmentAmount, lang)} />
              <Row label={t("businessFundUsage")} value={formatMoney(contract.currentUsage, lang)} />
              {contract.commitmentAmount > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-(--surface-soft)">
                  <div
                    className="h-full rounded-full bg-(--elizon-primary) transition-all"
                    style={{
                      width: `${Math.min(100, (contract.currentUsage / contract.commitmentAmount) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <Row label={t("businessFundOvercharge")} value={`${contract.overchargeFeePercent}%`} />
              {contract.bindingEndDate && (
                <Row label={t("businessFundBindingUntil")} value={fmtDate(contract.bindingEndDate)} />
              )}
              <p className="text-[10px] text-(--success)">{t("businessFundActive")}</p>
              {inBindingPeriod ? (
                <p className="rounded-[var(--radius-control)] bg-(--surface-soft) p-3 text-xs text-(--text-muted)">
                  {t("businessFundBindingNote").replace(
                    "{date}",
                    contract.bindingEndDate ? fmtDate(contract.bindingEndDate) : t("na"),
                  )}
                </p>
              ) : (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancel(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-(--error)/40 px-3 py-1.5 text-xs font-medium text-(--error) hover:bg-(--error)/10"
                  >
                    {t("businessFundCancel")}
                  </button>
                </div>
              )}
            </div>
          ) : contract && contract.status === "REQUESTED" ? (
            <p className="text-sm text-(--text-muted)">{t("businessFundRequestDesc")}</p>
          ) : contract && contract.status !== "ACTIVE" && !offer ? (
            <p className="text-sm text-(--text-muted)">{t("businessFundPendingReview")}</p>
          ) : !offer && !contract ? (
            <p className="text-sm text-(--text-muted)">{t("businessFundNone")}</p>
          ) : null}
        </section>
      )}

      <CancellationModal
        open={showCancel}
        title={t("businessFundCancelTitle")}
        consequences={[
          t("businessFundCancelConsequenceBenefit").replace(
            "{amount}",
            contract ? formatMoney(contract.commitmentAmount, lang) : t("na"),
          ),
          t("businessFundCancelConsequenceOvercharge"),
        ]}
        confirmLabel={t("businessFundCancelConfirm")}
        onConfirm={() => void confirmCancelFund()}
        onCancel={() => setShowCancel(false)}
        isLoading={busy}
      />

      {showFundRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="glass w-full max-w-md space-y-4 p-4">
            <h3 className="text-base font-semibold text-(--text-primary)">{t("businessFundRequest")}</h3>
            <p className="text-sm text-(--text-muted)">{t("businessFundRequestDesc")}</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("businessFundAmount")} (€)</Label>
              <Input
                type="number"
                min={25}
                step="0.01"
                value={fundRequestAmount}
                onChange={(e) => setFundRequestAmount(e.target.value)}
                placeholder="100.00"
                className="h-10 rounded-xl"
              />
              <p className="text-xs text-(--text-muted)">{t("businessFundAmountHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("businessFundBindingPeriod")}</Label>
              <select
                value={fundRequestBinding}
                onChange={(e) => setFundRequestBinding(e.target.value)}
                className="h-10 w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 text-sm text-(--text-primary) focus:outline-none"
              >
                <option value="3">3 {t("months")}</option>
                <option value="6">6 {t("months")}</option>
                <option value="12">12 {t("months")}</option>
                <option value="24">24 {t("months")}</option>
              </select>
            </div>
            <p className="rounded-[var(--radius-control)] bg-(--surface-soft) p-3 text-xs text-(--text-muted)">
              {t("businessFundNote")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFundRequest(false)}
                className="glass glass-hover rounded-xl px-4 py-2 text-sm text-(--text-secondary)"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void requestFund()}
                disabled={busy || !fundRequestValid}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("businessFundSubmitRequest")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="font-medium text-(--text-primary)">{value}</span>
    </div>
  );
}
