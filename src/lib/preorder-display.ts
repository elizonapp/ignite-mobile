/** Mobile-local preorder display helpers (mirror of lib/preorder/format). */

export type MobilePreorderFields = {
  preorderEnabled?: boolean;
  preorderEarliestAt?: string | null;
  preorderLatestAt?: string | null;
  preorderApproxMonth?: string | null;
};

function formatDate(iso: string | null | undefined, lang: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMonth(iso: string | null | undefined, lang: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", {
    year: "numeric",
    month: "long",
  });
}

export function formatMobilePreorderDeliveryLabel(
  fields: MobilePreorderFields | null | undefined,
  lang: string
): string {
  if (!fields?.preorderEnabled) {
    return lang === "de" ? "Lieferung unbekannt" : "Delivery unknown";
  }
  const parts: string[] = [];
  const earliest = formatDate(fields.preorderEarliestAt, lang);
  const latest = formatDate(fields.preorderLatestAt, lang);
  const approx = formatMonth(fields.preorderApproxMonth, lang);
  if (earliest) parts.push(lang === "de" ? `Frühestens ${earliest}` : `Earliest ${earliest}`);
  if (latest) parts.push(lang === "de" ? `Spätestens ${latest}` : `Latest ${latest}`);
  if (approx) parts.push(lang === "de" ? `Ungefähr ${approx}` : `Approximately ${approx}`);
  if (parts.length === 0) {
    return lang === "de" ? "Lieferung unbekannt" : "Delivery unknown";
  }
  return parts.join(" · ");
}

export function mobilePreorderCapacityDisclaimer(lang: string): string {
  if (lang === "de") {
    return "Aufgrund begrenzter Kapazitäten ist elizon berechtigt, Ihre Vorbestellung jederzeit zu stornieren. In diesem Fall erstatten wir den gezahlten Betrag auf das ursprüngliche Zahlungsmittel.";
  }
  return "Due to limited capacity, elizon may cancel your pre-order at any time. In that case we refund the amount paid to the original payment method.";
}
