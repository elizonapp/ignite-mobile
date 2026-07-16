import { useState } from "react";
import { Loader2, X } from "lucide-react";

import type { ServiceSubscriptionSummary } from "../../../api/services";
import { getApiErrorCode, resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { useToast } from "../../../components/Toast";
import { api } from "../../../lib/api";

type Step = "intro" | "offer" | "final";
type CancelType = "periodEnd" | "immediate";
type ContractCancelMode = "agb_notice" | "special" | "buyout";

export type CancelFlowModalProps = {
  open: boolean;
  onClose: () => void;
  serviceName: string;
  serviceId: string;
  subscription: ServiceSubscriptionSummary;
  onCanceled: () => void;
  onExtendRedirect?: (invoiceId: string) => void;
  t: (key: keyof import("../../../i18n/en").Dict) => string;
  formatDate: (date: string) => string;
};

export function CancelFlowModal({
  open,
  onClose,
  serviceName,
  serviceId,
  subscription,
  onCanceled,
  onExtendRedirect,
  t,
  formatDate,
}: CancelFlowModalProps) {
  const { show } = useToast();
  const isContract = subscription.billingMode === "CONTRACT";
  const [step, setStep] = useState<Step>("intro");
  const [cancelType, setCancelType] = useState<CancelType>("periodEnd");
  const [contractMode, setContractMode] = useState<ContractCancelMode>("agb_notice");
  const [specialReason, setSpecialReason] = useState("");
  const [loading, setLoading] = useState(false);

  const offerAvailable = subscription.extendEligibility?.bonusAvailable === true;
  const loyaltyOfferAvailable = subscription.extendEligibility?.loyaltyOfferAvailable === true;
  const bindingEnd = subscription.bindingEndsAt
    ? formatDate(subscription.bindingEndsAt)
    : formatDate(subscription.currentPeriodEnd);

  const resetAndClose = () => {
    setStep("intro");
    setCancelType("periodEnd");
    setContractMode("agb_notice");
    setSpecialReason("");
    setLoading(false);
    onClose();
  };

  const handleContinue = () => {
    if (!isContract && offerAvailable) setStep("offer");
    else setStep("final");
  };

  const handleRejectOffer = () => {
    setStep("final");
  };

  const handleExtend = async (payMethod: "redirect" | "balance", useLoyaltyOffer = false) => {
    setLoading(true);
    try {
      const res = await api.services.subscriptionExtend(serviceId, {
        withBonus: true,
        ...(useLoyaltyOffer ? { withLoyaltyOffer: true } : {}),
      });
      if (!res.success) {
        const code = getApiErrorCode(res);
        if (code === "theTotalRuntimeCannotExceed3YearsFromToday") {
          const data = res as { newPeriodEnd?: string; maxDate?: string };
          const msg = t("renewalExceedsMaxRuntime")
            .replace("{newEnd}", formatDate(data.newPeriodEnd ?? ""))
            .replace("{maxDate}", formatDate(data.maxDate ?? ""));
          show(msg, "error");
        } else {
          show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        }
        setLoading(false);
        return;
      }
      if (!res.invoiceId) {
        show(t("billingExtendSuccess"), "success");
        resetAndClose();
        onCanceled();
        return;
      }
      if (payMethod === "balance") {
        const payRes = await api.billing.payInvoice(res.invoiceId, { paymentMethod: "guthaben" });
        if (payRes.success) {
          show(t("billingExtendSuccess"), "success");
          resetAndClose();
          onCanceled();
          return;
        }
        show(resolveApiError(payRes, t, { fallbackKey: "unknownError" }), "error");
        setLoading(false);
        return;
      }
      show(t("billingExtendSuccess"), "success");
      onExtendRedirect?.(res.invoiceId);
      resetAndClose();
      onCanceled();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
      setLoading(false);
    }
  };

  const handleContractCancel = async () => {
    setLoading(true);
    try {
      const res = await api.services.subscriptionCancel(serviceId, false, {
        mode: contractMode,
        ...(contractMode === "special" ? { reason: specialReason } : {}),
      });
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        setLoading(false);
        return;
      }
      if (contractMode === "buyout" && res.invoiceId && onExtendRedirect) {
        show(t("billingContractBuyoutInvoiceCreated"), "success");
        onExtendRedirect(res.invoiceId);
      } else if (contractMode === "special") {
        show(t("billingContractSpecialRequested"), "success");
      } else {
        show(t("billingContractAgbNoticeSet"), "success");
      }
      resetAndClose();
      onCanceled();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
      setLoading(false);
    }
  };

  const handleCancelConfirm = async (immediate: boolean) => {
    setLoading(true);
    try {
      const res = await api.services.subscriptionCancel(serviceId, immediate);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        setLoading(false);
        return;
      }
      show(
        immediate ? t("subscriptionCanceledNowToast") : t("subscriptionCancelScheduledToast"),
        "success",
      );
      resetAndClose();
      onCanceled();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
      setLoading(false);
    }
  };

  if (!open) return null;

  const title =
    step === "intro"
      ? t("billingCancellation")
      : step === "offer"
        ? t("billingCancelFlowOfferTitle")
        : t("billingCancelFlowFinalTitle");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={t("cancel")}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="glass-overlay relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-(--border) shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-5 py-4">
          <h2 className="text-lg font-semibold text-(--text-primary)">{title}</h2>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--surface-soft) disabled:opacity-50"
            aria-label={t("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {step === "intro" && isContract && (
            <>
              <p className="text-sm text-(--text-secondary)">{t("billingContractCancelIntro")}</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-(--text-muted)">
                <li>{t("billingContractBindingEnd").replace("{date}", bindingEnd)}</li>
                <li>
                  {t("billingContractEarlyTerminationFeeInfo").replace(
                    "{percent}",
                    String(subscription.earlyTerminationFeePercent ?? 50),
                  )}
                </li>
                <li>
                  {t("billingContractNoticeInfo").replace(
                    "{days}",
                    String(subscription.contractNoticeDays ?? 14),
                  )}
                </li>
              </ul>
              <div>
                <label className="mb-2 block text-xs font-medium text-(--text-secondary)">
                  {t("billingContractCancelMode")}
                </label>
                <select
                  value={contractMode}
                  onChange={(e) => setContractMode(e.target.value as ContractCancelMode)}
                  className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--elizon-primary) focus:outline-none"
                >
                  <option value="agb_notice">{t("billingContractCancelAgb")}</option>
                  <option value="special">{t("billingContractCancelSpecial")}</option>
                  <option value="buyout">{t("billingContractCancelBuyout")}</option>
                </select>
              </div>
              {contractMode === "special" && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-(--text-secondary)">
                    {t("billingContractSpecialReason")}
                  </label>
                  <textarea
                    value={specialReason}
                    onChange={(e) => setSpecialReason(e.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--elizon-primary) focus:outline-none"
                    placeholder={t("billingContractSpecialReasonPlaceholder")}
                  />
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("final")}
                  className="rounded-xl bg-(--error)/90 px-4 py-2 text-sm font-medium text-white hover:bg-(--error)"
                >
                  {t("billingCancelFlowContinue")}
                </button>
              </div>
            </>
          )}

          {step === "intro" && !isContract && (
            <>
              <p className="text-sm text-(--text-secondary)">{t("billingCancelFlowIntro")}</p>
              <div>
                <label className="mb-2 block text-xs font-medium text-(--text-secondary)">
                  {t("billingCancelFlowCancelType")}
                </label>
                <select
                  value={cancelType}
                  onChange={(e) => setCancelType(e.target.value as CancelType)}
                  className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--elizon-primary) focus:outline-none"
                >
                  <option value="periodEnd">{t("billingCancelFlowFinalPeriodEnd")}</option>
                  <option value="immediate">{t("billingCancelFlowFinalImmediate")}</option>
                </select>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={resetAndClose} className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium">
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="rounded-xl bg-(--error)/90 px-4 py-2 text-sm font-medium text-white hover:bg-(--error)"
                >
                  {t("billingCancelFlowContinue")}
                </button>
              </div>
            </>
          )}

          {step === "offer" && !isContract && (
            <>
              <p className="text-sm text-(--text-secondary)">
                {loyaltyOfferAvailable ? t("billingCancelFlowOfferLoyaltyDesc") : t("billingCancelFlowOfferDesc")}
              </p>
              <div className="space-y-2 rounded-[var(--radius-control)] border border-(--elizon-primary)/30 bg-(--elizon-primary)/10 p-4">
                <p className="text-sm font-medium text-(--elizon-primary)">
                  {loyaltyOfferAvailable ? t("billingExtendLoyaltyWithBonus") : t("billingExtendWithBonus")}
                </p>
                <button
                  type="button"
                  onClick={() => void handleExtend("redirect", loyaltyOfferAvailable)}
                  disabled={loading}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? t("loading") : t("billingCancelFlowExtendPay")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExtend("balance", loyaltyOfferAvailable)}
                  disabled={loading}
                  className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? t("loading") : t("billingCancelFlowExtendBalance")}
                </button>
                <button
                  type="button"
                  onClick={handleRejectOffer}
                  disabled={loading}
                  className="w-full rounded-xl border border-(--border) px-4 py-2 text-sm font-medium text-(--error) hover:bg-(--error)/10 disabled:opacity-50"
                >
                  {t("billingCancelFlowRejectOffer")}
                </button>
              </div>
            </>
          )}

          {step === "final" && isContract && (
            <>
              <p className="whitespace-pre-line text-sm text-(--text-secondary)">
                {contractMode === "agb_notice"
                  ? t("billingContractAgbConfirm").replace("{end}", bindingEnd)
                  : contractMode === "special"
                    ? t("billingContractSpecialConfirm")
                    : t("billingContractBuyoutConfirm").replace(
                        "{percent}",
                        String(subscription.earlyTerminationFeePercent ?? 50),
                      )}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleContractCancel()}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--error)/90 px-4 py-2 text-sm font-medium text-white hover:bg-(--error) disabled:opacity-50"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? t("loading") : t("billingCancelFlowConfirmCancel")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("intro")}
                  disabled={loading}
                  className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {t("billingCancelFlowGoBack")}
                </button>
              </div>
            </>
          )}

          {step === "final" && !isContract && (
            <>
              <p className="text-base font-semibold text-(--error)">{t("billingCancelFlowFinalMotto")}</p>
              <p className="whitespace-pre-line text-sm text-(--text-secondary)">
                {t("billingCancelFlowFinalDesc").replace("{name}", serviceName)}
              </p>
              {cancelType === "periodEnd" && (
                <p className="text-xs text-(--text-muted)">
                  {t("billingYouCanCancelAnytime").replace(
                    "{end}",
                    formatDate(subscription.currentPeriodEnd),
                  )}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleCancelConfirm(cancelType === "immediate")}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--error)/90 px-4 py-2 text-sm font-medium text-white hover:bg-(--error) disabled:opacity-50"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? t("loading") : t("billingCancelFlowConfirmCancel")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(offerAvailable ? "offer" : "intro")}
                  disabled={loading}
                  className="btn-secondary w-full rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {t("billingCancelFlowGoBack")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
