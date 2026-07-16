import type { Lang } from "../../i18n";
import type { Dict } from "../../i18n/en";
import { getApiBaseUrl } from "../../lib/config";
import { openHostedFlow } from "../../lib/hosted-flow";
import type { InvoiceListItem } from "./types";

/** Widens the strict i18n `t` for APIs that accept arbitrary string keys (e.g. resolveApiError). */
export function looseTranslate(t: (key: keyof Dict) => string): (key: string) => string {
  return t as (key: string) => string;
}

/**
 * Money helpers. All monetary values coming from the billing/invoice/subscription
 * endpoints are decimal EUR amounts (e.g. 12.5 = 12,50 €), not cents.
 */
export function formatMoney(amount: number | null | undefined, lang: Lang, currency = "EUR"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(lang === "de" ? "de-DE" : "en-US");
}

/** Opens a payment or document URL inside the app shell. */
export function openExternalUrl(href: string, options?: { title?: string }): void {
  if (typeof window === "undefined") return;
  openHostedFlow(href, options);
}

const INVOICE_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  PAID: "success",
  paid: "success",
  PENDING: "warning",
  pending: "warning",
  OVERDUE: "danger",
  overdue: "danger",
  VOIDED: "muted",
  voided: "muted",
  CREDIT_NOTE: "muted",
};

export function invoiceStatusTone(status: string | null | undefined): "success" | "warning" | "danger" | "muted" {
  if (!status) return "muted";
  return INVOICE_STATUS_TONE[status] ?? "muted";
}

export function toneClasses(tone: "success" | "warning" | "danger" | "muted"): string {
  switch (tone) {
    case "success":
      return "bg-(--success)/15 text-(--success)";
    case "warning":
      return "bg-(--warning)/15 text-(--warning)";
    case "danger":
      return "bg-(--error)/15 text-(--error)";
    default:
      return "bg-(--surface-soft) text-(--text-muted)";
  }
}

/** Resolves relative API document paths to an absolute URL for hosted-flow / downloads. */
export function resolveApiUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatTaxLabel(
  taxName: string | null | undefined,
  taxRatePercent: number | null | undefined,
  t: (key: string) => string,
): string {
  if (!taxName) return t("taxIncluded");
  const pct = taxRatePercent != null ? `${taxRatePercent} % ` : "";
  return `${taxName} (${pct}${t("taxIncludedSuffix")})`;
}

type InvoiceStatusSource = {
  status: string;
  claimHandedToCollection?: boolean;
  hasPendingMolliePayment?: boolean;
  isCreditNote?: boolean;
};

export function getInvoiceStatusLabel(
  invoice: InvoiceStatusSource,
  t: (key: string) => string,
): string {
  if ("isCreditNote" in invoice && invoice.isCreditNote) return t("billingCreditNote");
  if (invoice.status === "REFUNDED" || invoice.status === "PARTIALLY_REFUNDED") return t("billingRefunded");
  if (invoice.status === "CANCELLED") return t("billingCancelled");
  if (invoice.status === "PAID") return t("billingPaid");
  if (invoice.status === "VOIDED") return t("billingVoided");
  if (invoice.claimHandedToCollection) return t("billingClaimHandedToCollection");
  if (invoice.status === "OVERDUE") return t("billingOverdue");
  if (invoice.hasPendingMolliePayment) return t("paymentProcessingShort");
  return t("billingPending");
}

export function getPaymentRequestStatusLabel(
  invoice: Pick<InvoiceListItem, "status" | "claimHandedToCollection">,
  t: (key: string) => string,
): string {
  if (invoice.claimHandedToCollection) return t("billingClaimHandedToCollection");
  if (invoice.status === "VOIDED") return t("billingVoided");
  if (invoice.status === "PENDING") return t("billingPending");
  return t("billingOverdue");
}
