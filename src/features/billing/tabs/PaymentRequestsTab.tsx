import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";

import { useRouter } from "../../../components/Router";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { canManageBilling } from "../../../lib/platform";
import { cn } from "../../../lib/utils";
import {
  formatDate,
  formatMoney,
  getPaymentRequestStatusLabel,
  invoiceStatusTone,
  looseTranslate,
  toneClasses,
} from "../lib";
import type { InvoiceListItem } from "../types";

type StatusFilter = "all" | "PENDING" | "OVERDUE" | "VOIDED";

const STATUS_FILTERS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "invoiceFilterAll" },
  { key: "PENDING", labelKey: "invoiceFilterOpen" },
  { key: "OVERDUE", labelKey: "invoiceFilterOverdue" },
  { key: "VOIDED", labelKey: "billingVoided" },
];

const PAGE_SIZE = 15;

type ServiceOption = { id: string; name: string; isDeleted: boolean };

export function PaymentRequestsTab() {
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const translate = looseTranslate(t);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, svcRes] = await Promise.all([
        api.billing.invoices({ limit: 500 }),
        api.services.list(500, "compact"),
      ]);

      if (invRes.success) {
        setInvoices((invRes.invoices ?? []) as InvoiceListItem[]);
        setError(null);
      } else {
        setError(resolveApiError(invRes, translate, { fallbackKey: "unknownError" }));
      }

      if (svcRes.success) {
        const rows = (svcRes.servers ?? svcRes.services ?? []) as Array<{
          id: string;
          name: string;
          status?: string;
        }>;
        setServices(
          rows.map((s) => ({
            id: s.id,
            name: s.name,
            isDeleted: (s.status ?? "").toUpperCase() === "DELETED",
          })),
        );
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, translate));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const paymentRequests = useMemo(
    () => invoices.filter((inv) => inv.status !== "PAID" && !inv.isCreditNote),
    [invoices],
  );

  const filtered = useMemo(() => {
    return paymentRequests.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (serviceFilter !== "all" && !inv.serviceIds?.includes(serviceFilter)) return false;
      return true;
    });
  }, [paymentRequests, serviceFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeServices = services.filter((s) => !s.isDeleted);
  const deletedServices = services.filter((s) => s.isDeleted);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className="space-y-3">
      <div className="glass space-y-3 p-4">
        <div>
          <h2 className="text-sm font-medium text-(--text-primary)">{t("billingPaymentRequests")}</h2>
          <p className="mt-0.5 text-xs text-(--text-muted)">{t("billingPaymentRequestsDesc")}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
            aria-label={t("status")}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {t(f.labelKey as never)}
              </option>
            ))}
          </select>

          {services.length > 0 && (
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
              aria-label={t("billingFilterService")}
            >
              <option value="all">{t("billingFilterService")}</option>
              {activeServices.length > 0 && (
                <optgroup label={t("activeServices")}>
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {deletedServices.length > 0 && (
                <optgroup label={t("deletedServices")}>
                  {deletedServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({t("deleted")})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-(--border) px-3 text-(--text-secondary) hover:bg-(--bg-elevated)"
            aria-label={t("refresh")}
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass flex flex-col items-center p-8 text-center">
          <Clock className="size-10 text-(--text-muted) opacity-50" />
          <p className="mt-3 text-sm text-(--text-muted)">{t("noPaymentRequests")}</p>
        </div>
      ) : (
        <>
          {paginated.map((inv) => {
            const tone = invoiceStatusTone(inv.claimHandedToCollection ? "OVERDUE" : inv.status);
            const label = getPaymentRequestStatusLabel(inv, translate);
            return (
              <button
                key={inv.id}
                type="button"
                onClick={() => navigate({ name: "invoice-detail", id: inv.id })}
                className="glass glass-hover flex w-full flex-col gap-2 p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                    <AlertCircle className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">
                      {inv.displayVoucherNumber || inv.number || inv.invoiceNumber}
                    </p>
                    <p className="text-[11px] text-(--text-muted)">
                      {formatDate(inv.issuedAt ?? inv.createdAt, lang)}
                      {(inv.netPointsRedeemed ?? 0) > 0 && (
                        <span className="ml-1 text-(--primary)">
                          · {t("netPointsRedeemedOnInvoice")}: {inv.netPointsRedeemed}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-(--text-primary)">
                      {formatMoney(inv.total ?? inv.amount, lang, inv.currency)}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", toneClasses(tone))}>
                      {label}
                    </span>
                  </div>
                </div>
                {inv.claimSuspended && !inv.claimHandedToCollection && !inv.isCreditNote ? (
                  <div className="rounded-[var(--radius-control)] border border-(--warning)/30 bg-(--warning)/10 px-3 py-2 text-xs text-(--warning)">
                    <p className="font-medium">{t("billingClaimSuspended")}</p>
                    {inv.claimSuspendedReason ? (
                      <p className="mt-0.5 text-(--text-secondary)">{inv.claimSuspendedReason}</p>
                    ) : null}
                    {inv.claimSuspendedUserNote ? (
                      <p className="mt-0.5 text-(--text-muted)">{inv.claimSuspendedUserNote}</p>
                    ) : null}
                  </div>
                ) : null}
              </button>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="glass glass-hover inline-flex size-10 items-center justify-center rounded-lg disabled:opacity-40"
                aria-label={t("back")}
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-xs text-(--text-muted)">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="glass glass-hover inline-flex size-10 items-center justify-center rounded-lg disabled:opacity-40"
                aria-label={t("continue")}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}

      {!isLoading && filtered.length > 0 && canManageBilling() && (
        <p className="text-center text-[11px] text-(--text-muted)">
          {t("billingItemsPerPage")}: {PAGE_SIZE}
        </p>
      )}
    </div>
  );
}
