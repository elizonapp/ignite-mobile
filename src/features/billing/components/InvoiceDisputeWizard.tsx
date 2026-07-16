import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { formatDate } from "../lib";

const DISPUTE_REASON_MIN_LENGTH = 20;

type InvoiceDisputeWizardProps = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  disputeDeadlineAt?: string | null;
  onSuccess: (result: { ticketId: string; ticketNumber: string }) => void;
  onError: (message: string) => void;
};

export function InvoiceDisputeWizard({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  disputeDeadlineAt,
  onSuccess,
  onError,
}: InvoiceDisputeWizardProps) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const deadlineLabel = formatDate(disputeDeadlineAt, lang);
  const trimmedReason = reason.trim();
  const canContinueReason = trimmedReason.length >= DISPUTE_REASON_MIN_LENGTH;

  const resetAndClose = () => {
    setStep(1);
    setReason("");
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canContinueReason || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.billing.disputeInvoice(invoiceId, trimmedReason);
      if (res.success) {
        onSuccess({
          ticketId: String(res.ticketId ?? ""),
          ticketNumber: String(res.ticketNumber ?? ""),
        });
        resetAndClose();
      } else {
        onError(resolveApiError(res, t, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      onError(resolveCaughtApiError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={t("cancel")}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-dispute-title"
        className="glass-overlay relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-(--border) p-5 shadow-lg"
      >
        <h2 id="invoice-dispute-title" className="text-lg font-semibold text-(--text-primary)">
          {t("billingDisputeTitle")}
        </h2>

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-(--text-secondary)">{t("billingDisputeIntro")}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-(--text-secondary)">
              <li>{t("billingDisputeWindowInfo").replace("{date}", deadlineLabel)}</li>
              <li>{t("billingDisputeReceiptOnly")}</li>
              <li>{t("billingDisputeTicketInfo")}</li>
            </ul>
            <div className="rounded-[var(--radius-control)] bg-(--surface-soft) px-3 py-2 text-sm">
              <span className="text-(--text-muted)">{t("billingPaymentRequestId")}: </span>
              <span className="font-medium text-(--text-primary)">{invoiceNumber}</span>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetAndClose} className="btn-secondary rounded-xl px-4 py-2 text-sm">
                {t("cancel")}
              </button>
              <button type="button" onClick={() => setStep(2)} className="btn-primary rounded-xl px-4 py-2 text-sm">
                {t("billingDisputeContinue")}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-(--text-secondary)">{t("billingDisputeReasonHint")}</p>
            <label className="block space-y-1 text-sm">
              <span className="text-(--text-muted)">{t("billingDisputeReasonLabel")} *</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={6}
                className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
                placeholder={t("billingDisputeReasonPlaceholder")}
              />
            </label>
            <p className="text-xs text-(--text-muted)">
              {t("billingDisputeReasonMin")
                .replace("{min}", String(DISPUTE_REASON_MIN_LENGTH))
                .replace("{count}", String(trimmedReason.length))}
            </p>
            <p className="text-xs text-(--text-muted)">* {t("requiredFieldLegend" as never)}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary rounded-xl px-4 py-2 text-sm">
                {t("back")}
              </button>
              <button
                type="button"
                disabled={!canContinueReason}
                onClick={() => setStep(3)}
                className={cn("btn-primary rounded-xl px-4 py-2 text-sm", !canContinueReason && "opacity-50")}
              >
                {t("billingDisputeContinue")}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-(--text-secondary)">{t("billingDisputeConfirmIntro")}</p>
            <div className="space-y-2 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) p-3 text-sm">
              <div>
                <span className="text-(--text-muted)">{t("billingPaymentRequestId")}: </span>
                <span className="font-medium text-(--text-primary)">{invoiceNumber}</span>
              </div>
              <div>
                <div className="mb-1 text-(--text-muted)">{t("billingDisputeReasonLabel")}</div>
                <p className="whitespace-pre-wrap text-(--text-primary)">{trimmedReason}</p>
              </div>
            </div>
            <p className="text-xs text-(--text-muted)">{t("billingDisputeReceiptOnly")}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary rounded-xl px-4 py-2 text-sm">
                {t("back")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : t("billingDisputeSubmit")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
