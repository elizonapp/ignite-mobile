import { useCallback, useEffect, useState } from "react";

import { ArrowLeft, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { canManageBilling } from '../lib/platform';

import { useRouter } from '../components/Router';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { api } from '../lib/api';

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  dueDate?: string | null;
  paidAt?: string | null;
  pdfUrl?: string | null;
  items?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
};

export function InvoicesScreen() {
  const { t } = useI18n();
  const { navigate } = useRouter();
  const { show } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await api.billing.invoices(50);
      if (data.success) {
        setInvoices((data.invoices ?? []) as Invoice[]);
        setError(null);
      } else {
        setError(t("unknownError"));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const openInvoice = async (id: string) => {
    try {
      const data = await api.billing.invoice(id);
      if (data.success) {
        setSelectedInvoice(data.invoice as Invoice);
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "paid": return "text-green-400";
      case "pending": return "text-yellow-400";
      case "overdue": return "text-red-400";
      case "cancelled": return "text-(--text-muted)";
      default: return "text-(--text-secondary)";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  };

  // Invoice detail view
  if (selectedInvoice) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setSelectedInvoice(null)}
            className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-semibold text-(--text-primary)">
              {selectedInvoice.invoiceNumber}
            </h1>
            <p className={`text-xs ${statusColor(selectedInvoice.status)}`}>{selectedInvoice.status}</p>
          </div>
        </div>

        <main className="safe-x safe-bottom flex-1 space-y-4 overflow-y-auto pb-4">
          {/* Amount */}
          <div className="glass p-4 text-center">
            <p className="text-3xl font-bold text-(--text-primary)">
              {formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}
            </p>
            <p className="mt-1 text-xs text-(--text-muted)">
              {t("invoiceDate")}: {new Date(selectedInvoice.createdAt).toLocaleDateString()}
            </p>
            {selectedInvoice.dueDate && (
              <p className="text-xs text-(--text-muted)">
                {t("invoiceDue")}: {new Date(selectedInvoice.dueDate).toLocaleDateString()}
              </p>
            )}
            {selectedInvoice.paidAt && (
              <p className="text-xs text-green-400">
                {t("invoicePaid")}: {new Date(selectedInvoice.paidAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Items */}
          {selectedInvoice.items && selectedInvoice.items.length > 0 && (
            <div className="glass p-4">
              <h3 className="mb-3 text-sm font-medium text-(--text-primary)">{t("invoiceItems")}</h3>
              <div className="space-y-2">
                {selectedInvoice.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-(--text-primary)">{item.description}</p>
                      <p className="text-[11px] text-(--text-muted)">
                        {item.quantity}x {formatCurrency(item.unitPrice, selectedInvoice.currency)}
                      </p>
                    </div>
                    <p className="ml-2 font-medium text-(--text-primary)">
                      {formatCurrency(item.total, selectedInvoice.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              {selectedInvoice.pdfUrl && (
                <a
                  href={selectedInvoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass glass-hover flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-(--text-primary)"
                >
                  <Download className="size-4" />
                  {t("invoiceDownload")}
                </a>
              )}
              {canManageBilling() && selectedInvoice.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => navigate({ name: "invoice-pay", id: selectedInvoice.id })}
                  className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
                >
                  <ExternalLink className="size-4" />
                  {t("invoicePay")}
                </button>
              ) : selectedInvoice.status === "pending" ? (
                <div className="glass border border-(--warning)/30 rounded-xl p-4 text-sm text-(--text-muted)">
                  {t("invoicePayDesktopOnly")}
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Invoice list
  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ name: "dashboard" })}
            className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("invoices")}</h1>
        </div>
        <button
          type="button"
          onClick={() => void fetchInvoices()}
          className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <main className="safe-x safe-bottom flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-(--text-muted)" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="glass p-6 text-center">
            <p className="text-sm text-(--text-muted)">{t("noInvoices")}</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => openInvoice(invoice.id)}
              className="glass glass-hover w-full rounded-xl p-3 text-left"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--text-primary)">
                    {invoice.invoiceNumber}
                  </p>
                  <p className="mt-0.5 text-[11px] text-(--text-muted)">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-2 flex flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold text-(--text-primary)">
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </span>
                  <span className={`text-[11px] font-medium ${statusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </main>
    </div>
  );
}
