/**
 * Opens the Mollie payment page. In Electron the payment must open in the system
 * browser (never in an embedded WebView, see mobile-audit). In browser-dev we
 * navigate the current window as a fallback.
 */
export function openMollieRedirect(url: string): void {
  if (typeof window === "undefined") return;

  if (window.electron?.openExternal) {
    window.electron.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
