import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Loader2,
  MessageSquareWarning,
} from "lucide-react";

import { useRouter } from "../../components/Router";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n";
import { resolveApiError } from "../../api/resolve-error";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { canManageBilling } from "../../lib/platform";
import { cn } from "../../lib/utils";
import { InvoiceDisputeWizard } from "./components/InvoiceDisputeWizard";
import {
  formatDate,
  formatMoney,
  formatTaxLabel,
  getInvoiceStatusLabel,
  invoiceStatusTone,
  looseTranslate,
  openExternalUrl,
  resolveApiUrl,
  toneClasses,
} from "./lib";
import type { InvoiceDetail } from "./types";

type InvoiceDetailScreenProps = {
  id: string;
};

const PAYABLE = new Set(["PENDING", "OVERDUE"]);

export function InvoiceDetailScreen({ id }: InvoiceDetailScreenProps) {
  const { t, lang } = useI18n();
  const { navigate, back } = useRouter();
  const { show } = useToast();
  const translate = looseTranslate(t);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDisputeWizard, setShowDisputeWizard] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.billing.invoice(id);
      if (res.success && res.invoice) {
        setInvoice(res.invoice as InvoiceDetail);
        setError(null);
      } else {
        if (!silent) setError(resolveApiError(res, translate, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      if (!silent) setError(resolveCaughtApiError(err, translate));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!invoice || invoice.status === "PAID" || invoice.status === "VOIDED") return;
    if (!invoice.hasPendingMolliePayment) return;

    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      if (attempts >= 30) {
        window.clearInterval(interval);
        return;
      }
      await load(true);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [invoice?.status, invoice?.hasPendingMolliePayment, load]);

  const openDocument = (path: string | null | undefined, title: string) => {
    const url = resolveApiUrl(path);
    if (!url) return;
    openExternalUrl(url, { title });
  };

  const paymentMailLabel = (slug: string) => {
    const key = `billingPaymentMailSlug_${slug}`;
    const label = t(key as never);
    return label === key ? slug : label;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-(--text-muted)" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-sm text-(--error)">{error ?? t("unknownError")}</p>
        <button type="button" onClick={back} className="btn-secondary rounded-xl px-4 py-2 text-sm">
          {t("back")}
        </button>
      </div>
    );
  }

  const isUnpaid = PAYABLE.has(invoice.status);
  const isVoided = invoice.status === "VOIDED";
  const handedToCollection = Boolean(invoice.claimHandedToCollection);
  const hasCreditNote = Boolean(invoice.lexwareCreditNoteVoucherId);
  const statusLabel = getInvoiceStatusLabel(invoice, translate);
  const tone = invoiceStatusTone(invoice.status);
  const documentUrl = resolveApiUrl(
    invoice.pdfUrl ?? (invoice.hasLexwareDocument ? `/api/invoices/${invoice.id}/document` : null),
  );
  const dunningUrl = resolveApiUrl(
    invoice.dunningDocumentUrl ?? (invoice.hasDunningDocument ? `/api/invoices/${invoice.id}/dunning-document` : null),
  );
  const creditNoteUrl = resolveApiUrl(invoice.creditNoteDocumentUrl);
  const payable = canManageBilling() && isUnpaid && !handedToCollection && !invoice.hasPendingMolliePayment;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-4 page-fullwidth">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={back}
          className="mt-0.5 rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
          aria-label={t("back")}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-(--text-primary)">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            {t("invoiceDue")}: {formatDate(invoice.dueAt, lang)} ·{" "}
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", toneClasses(tone))}>
              {statusLabel}
            </span>
          </p>
        </div>
      </div>

      {invoice.hasPendingMolliePayment && isUnpaid && !handedToCollection && (
        <div className="glass flex items-start gap-3 border border-(--warning)/30 bg-(--warning)/5 p-4">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-(--warning)" />
          <div>
            <p className="text-sm font-medium text-(--text-primary)">{t("paymentProcessing")}</p>
            <p className="mt-0.5 text-xs text-(--text-muted)">{t("paymentProcessingHint")}</p>
          </div>
        </div>
      )}

      {handedToCollection && (
        <div className="glass border border-(--error)/40 bg-(--error)/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-(--error)">
            <AlertTriangle className="size-4 shrink-0" />
            {t("billingClaimHandedToCollection")}
          </p>
          <p className="mt-1 text-sm text-(--text-secondary)">{t("billingClaimHandedToCollectionHint")}</p>
          {invoice.claimHandedOverAt && (
            <p className="mt-2 text-xs text-(--text-muted)">
              {t("billingClaimHandedToCollectionDate").replace(
                "{date}",
                formatDate(invoice.claimHandedOverAt, lang),
              )}
            </p>
          )}
        </div>
      )}

      {invoice.claimSuspended && !handedToCollection && (
        <div className="glass border border-(--warning)/40 bg-(--warning)/10 p-4">
          <p className="text-sm font-semibold text-(--warning)">{t("billingClaimSuspended")}</p>
          <p className="mt-1 text-xs text-(--text-muted)">{t("billingClaimSuspendedHint")}</p>
          {invoice.claimSuspendedReason ? (
            <p className="mt-2 text-sm text-(--text-secondary)">{invoice.claimSuspendedReason}</p>
          ) : null}
          {invoice.claimSuspendedUserNote ? (
            <p className="mt-1 text-xs text-(--text-muted)">{invoice.claimSuspendedUserNote}</p>
          ) : null}
        </div>
      )}

      <div className="glass space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-(--text-muted)">{t("billingInvoiceAmount")}</p>
            <p className="text-2xl font-bold text-(--text-primary)">
              {formatMoney(invoice.total, lang, invoice.currency)}
            </p>
          </div>
          <div className="text-right text-xs text-(--text-muted)">
            <p>
              {t("invoiceDate")}: {formatDate(invoice.issuedAt, lang)}
            </p>
            {invoice.paidAt && (
              <p>
                {t("invoicePaid")}: {formatDate(invoice.paidAt, lang)}
              </p>
            )}
          </div>
        </div>

        {invoice.items.length > 0 && (
          <div className="space-y-2 border-t border-(--border) pt-4">
            <h2 className="text-sm font-medium text-(--text-primary)">{t("invoiceItems")}</h2>
            {invoice.items.map((item, index) => (
              <div key={item.id ?? index} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-(--text-primary)">{item.description}</p>
                  <p className="text-[11px] text-(--text-muted)">
                    {item.quantity} × {formatMoney(item.unitPrice, lang, invoice.currency)}
                  </p>
                </div>
                <p className="shrink-0 font-medium text-(--text-primary)">
                  {formatMoney(item.total, lang, invoice.currency)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1 border-t border-(--border) pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-(--text-muted)">{t("netAmount")}</span>
            <span>{formatMoney(invoice.subtotal, lang, invoice.currency)}</span>
          </div>
          {(invoice.netPointsRedeemed ?? 0) > 0 && (
            <div className="flex justify-between text-(--success)">
              <span>{t("netPointsDiscount")}</span>
              <span>-{formatMoney(invoice.netPointsRedeemedAmount ?? 0, lang, invoice.currency)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-(--text-muted)">
              {formatTaxLabel(invoice.taxName, invoice.taxRatePercent, translate)}
            </span>
            <span>{formatMoney(invoice.taxAmount, lang, invoice.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-(--border) pt-2 text-base font-semibold">
            <span>{t("totalInclVat")}</span>
            <span>{formatMoney(invoice.total, lang, invoice.currency)}</span>
          </div>
          {(invoice.netPointsRedeemed ?? 0) > 0 && (
            <p className="pt-1 text-xs text-(--text-muted)">
              {t("netPointsRedeemedOnInvoice")}: {invoice.netPointsRedeemed}
            </p>
          )}
        </div>
      </div>

      {invoice.sepaDetails && isUnpaid && !handedToCollection && (
        <div className="glass space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
            <Landmark className="size-4 text-(--elizon-primary)" />
            {t("billingSepaTransferTitle")}
          </h2>
          <p className="text-xs text-(--text-muted)">{t("billingSepaTransferHint")}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {invoice.sepaDetails.bankName && (
              <div>
                <dt className="text-xs text-(--text-muted)">{t("billingSepaBank")}</dt>
                <dd className="font-medium text-(--text-primary)">{invoice.sepaDetails.bankName}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-(--text-muted)">IBAN</dt>
              <dd className="font-mono text-(--text-primary)">{invoice.sepaDetails.iban}</dd>
            </div>
            <div>
              <dt className="text-xs text-(--text-muted)">BIC</dt>
              <dd className="font-mono text-(--text-primary)">{invoice.sepaDetails.bic}</dd>
            </div>
            <div>
              <dt className="text-xs text-(--text-muted)">{t("billingSepaReference")}</dt>
              <dd className="font-mono text-(--text-primary)">{invoice.sepaDetails.reference}</dd>
            </div>
            <div>
              <dt className="text-xs text-(--text-muted)">{t("billingInvoiceAmount")}</dt>
              <dd className="font-medium text-(--text-primary)">
                {formatMoney(invoice.sepaDetails.amount, lang, invoice.currency)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {invoice.hasDunningDocument && (
        <div className="glass space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-(--text-primary)">{t("billingDunning")}</h2>
              {invoice.dunningCreatedAt && (
                <p className="mt-0.5 text-xs text-(--text-muted)">{formatDate(invoice.dunningCreatedAt, lang)}</p>
              )}
            </div>
            {dunningUrl && (
              <button
                type="button"
                onClick={() => openDocument(dunningUrl, t("billingDunning"))}
                className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs"
              >
                <Download className="size-3.5" />
                {t("billingDunningDownload")}
              </button>
            )}
          </div>
        </div>
      )}

      {hasCreditNote && (
        <div className="glass space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-(--text-primary)">{t("billingCreditNote")}</h2>
              <p className="mt-0.5 text-xs text-(--text-muted)">
                {invoice.lexwareCreditNoteVoucherId}
                {invoice.creditNoteForInvoiceNumber
                  ? ` · ${t("billingCreditNoteFor")} ${invoice.creditNoteForInvoiceNumber}`
                  : ""}
              </p>
            </div>
            {creditNoteUrl && (
              <button
                type="button"
                onClick={() => openDocument(creditNoteUrl, t("billingCreditNote"))}
                className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs"
              >
                <Download className="size-3.5" />
                {t("billingDownload")}
              </button>
            )}
          </div>
        </div>
      )}

      {!!invoice.paymentMailLogs?.length && (
        <div className="glass space-y-3 p-4">
          <h2 className="text-sm font-medium text-(--text-primary)">{t("billingPaymentMailLogsTitle")}</h2>
          <ul className="space-y-2">
            {invoice.paymentMailLogs.map((log) => (
              <li
                key={log.id}
                className="rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) px-3 py-2"
              >
                <p className="text-sm font-medium text-(--text-primary)">{paymentMailLabel(log.templateSlug)}</p>
                <p className="text-[11px] text-(--text-muted)">
                  {new Date(log.createdAt).toLocaleString(lang === "de" ? "de-DE" : "en-US")}
                </p>
                {!!log.documentRefs?.length && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {log.documentRefs.map((ref) => (
                      <button
                        key={`${log.id}-${ref.type}`}
                        type="button"
                        onClick={() =>
                          openDocument(
                            ref.href,
                            ref.type === "dunning" ? t("billingPaymentMailDocDunning") : t("billingPaymentMailDocInvoice"),
                          )
                        }
                        className="text-xs text-(--primary) hover:underline"
                      >
                        {ref.type === "dunning" ? t("billingPaymentMailDocDunning") : t("billingPaymentMailDocInvoice")}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {documentUrl && (
          <button
            type="button"
            onClick={() => openDocument(documentUrl, t("invoiceDownload"))}
            className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <FileText className="size-4" />
            {t("billingDownload")}
          </button>
        )}
        {invoice.canDispute && (
          <button
            type="button"
            onClick={() => setShowDisputeWizard(true)}
            className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <MessageSquareWarning className="size-4" />
            {t("billingDispute")}
          </button>
        )}
        {invoice.disputeTicketId && !invoice.canDispute && (
          <button
            type="button"
            onClick={() => navigate({ name: "support" })}
            className="btn-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <MessageSquareWarning className="size-4" />
            {t("billingDisputeOpenTicket")}
          </button>
        )}
        {payable && !isVoided && (
          <button
            type="button"
            onClick={() => navigate({ name: "invoice-pay", id: invoice.id })}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <CreditCard className="size-4" />
            {t("servicePayOpenInvoiceCta")}
          </button>
        )}
      </div>

      <InvoiceDisputeWizard
        open={showDisputeWizard}
        onClose={() => setShowDisputeWizard(false)}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        disputeDeadlineAt={invoice.disputeDeadlineAt}
        onSuccess={(result) => {
          show(t("billingDisputeSubmitted"), "success");
          setInvoice((prev) =>
            prev
              ? {
                  ...prev,
                  canDispute: false,
                  disputeTicketId: result.ticketId || prev.disputeTicketId,
                  disputeTicketNumber: result.ticketNumber || prev.disputeTicketNumber,
                }
              : prev,
          );
        }}
        onError={(message) => show(message, "error")}
      />
    </div>
  );
}
