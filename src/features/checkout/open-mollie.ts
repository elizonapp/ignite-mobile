import { openHostedFlow } from "../../lib/hosted-flow";

/** Opens the Mollie payment page inside the app shell. */
export function openMollieRedirect(url: string): void {
  if (typeof window === "undefined") return;
  openHostedFlow(url, { title: "Zahlung" });
}
