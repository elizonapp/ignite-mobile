import { useCallback, useEffect, useState } from "react";

import { ArrowLeft, Loader2, Receipt, RefreshCw } from "lucide-react";

import { useRouter } from '../components/Router';
import { useI18n } from '../i18n';
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { api } from '../lib/api';
import { formatDate, formatMoney, invoiceStatusTone, toneClasses } from "../features/billing/lib";
import { formatResourceStatus } from "../i18n/format-status";
import type { InvoiceListItem } from "../features/billing/types";
import { cn } from "../lib/utils";

export function InvoicesScreen() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await api.billing.invoices({ limit: 50 });
      if (data.success) {
        setInvoices((data.invoices ?? []) as InvoiceListItem[]);
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
          invoices.map((invoice) => {
            const tone = invoiceStatusTone(invoice.status);
            return (
              <button
                key={invoice.id}
                type="button"
                onClick={() => navigate({ name: "invoice-detail", id: invoice.id })}
                className="glass glass-hover w-full rounded-xl p-3 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                    <Receipt className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">
                      {invoice.displayVoucherNumber || invoice.number || invoice.invoiceNumber}
                    </p>
                    <p className="mt-0.5 text-[11px] text-(--text-muted)">
                      {formatDate(invoice.issuedAt ?? invoice.createdAt, lang)}
                    </p>
                  </div>
                  <div className="ml-2 flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold text-(--text-primary)">
                      {formatMoney(invoice.total ?? invoice.amount, lang, invoice.currency)}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", toneClasses(tone))}>
                      {formatResourceStatus(invoice.status, t)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}
