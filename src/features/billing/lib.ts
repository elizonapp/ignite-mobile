import type { Lang } from "../../i18n";

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

type ElectronBridge = {
  openExternal?: (url: string) => void;
  openWindow?: (url: string) => void;
};

/**
 * Opens an external payment URL (Mollie). On Electron we use the native bridge
 * (openExternal) instead of an embedded WebView, per the security plan.
 */
export function openExternalUrl(href: string): void {
  if (typeof window === "undefined") return;
  const electron = (window as Window & { electron?: ElectronBridge }).electron;
  if (electron?.openExternal) {
    electron.openExternal(href);
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
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
