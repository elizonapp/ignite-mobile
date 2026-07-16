import { useCallback, useEffect, useState } from "react";
import { CreditCard, Receipt, RefreshCw } from "lucide-react";

import { useRouter } from "../../../components/Router";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { canManageBilling } from "../../../lib/platform";
import { cn } from "../../../lib/utils";
import { formatResourceStatus } from "../../../i18n/format-status";
import { formatDate, formatMoney, invoiceStatusTone, looseTranslate, toneClasses } from "../lib";
import type { InvoiceListItem } from "../types";

type Filter = "all" | "PENDING" | "PAID" | "OVERDUE";

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: "all", labelKey: "invoiceFilterAll" },
  { key: "PENDING", labelKey: "invoiceFilterOpen" },
  { key: "OVERDUE", labelKey: "invoiceFilterOverdue" },
  { key: "PAID", labelKey: "invoiceFilterPaid" },
];

const PAYABLE = new Set(["PENDING", "OVERDUE"]);

export function InvoicesTab() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const translate = looseTranslate(t);
  const [filter, setFilter] = useState<Filter>("all");
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.billing.invoices({
        limit: 50,
        status: filter === "all" ? undefined : filter,
      });
      if (res.success) {
        setInvoices((res.invoices ?? []) as InvoiceListItem[]);
        setError(null);
      } else {
        setError(resolveApiError(res, translate, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, translate));
    } finally {
      setIsLoading(false);
    }
  }, [filter, translate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-(--primary) text-white"
                : "bg-(--surface-soft) text-(--text-secondary) hover:text-(--text-primary)",
            )}
          >
            {t(f.labelKey as never)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto shrink-0 rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
          aria-label={t("refresh")}
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {error ? (
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-16 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("noInvoices")}</div>
      ) : (
        invoices.map((inv) => {
          const tone = invoiceStatusTone(inv.status);
          const payable = canManageBilling() && !inv.isCreditNote && PAYABLE.has(inv.status);
          return (
            <div key={inv.id} className="glass flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={() => navigate({ name: "invoice-detail", id: inv.id })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                  <Receipt className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--text-primary)">
                    {inv.displayVoucherNumber || inv.number || inv.invoiceNumber}
                  </p>
                  <p className="text-[11px] text-(--text-muted)">{formatDate(inv.issuedAt ?? inv.createdAt, lang)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-(--text-primary)">
                    {formatMoney(inv.total ?? inv.amount, lang, inv.currency)}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", toneClasses(tone))}>
                    {formatResourceStatus(inv.status, translate)}
                  </span>
                </div>
              </button>
              {payable && (
                <button
                  type="button"
                  onClick={() => navigate({ name: "invoice-pay", id: inv.id })}
                  className="btn-primary ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium"
                >
                  <CreditCard className="size-3.5" />
                  {t("invoicePay")}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
