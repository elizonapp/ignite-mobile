import { useState } from "react";
import { Check, Copy, Globe2 } from "lucide-react";

import { useProviderT } from "../use-provider-t";
import type { ProviderWidgetProps } from "../types";

/**
 * Mobile port of the web "ip-addresses" / "game-network" widgets. Renders the
 * primary and secondary IPs from the loaded service network with copy buttons.
 * IP cancellation/firewall management stays desktop-only.
 */
export default function IpAddressesWidget({ context }: ProviderWidgetProps) {
  const t = useProviderT();
  const network = context?.network;

  const ipv4s = [
    network?.primaryIpv4,
    ...(network?.secondaryIps.filter((s) => s.ipVersion === 4).map((s) => s.ipAddress) ?? []),
  ].filter(Boolean) as string[];
  const ipv6s = [
    network?.primaryIpv6,
    ...(network?.secondaryIps.filter((s) => s.ipVersion === 6).map((s) => s.ipAddress) ?? []),
  ].filter(Boolean) as string[];

  if (!ipv4s.length && !ipv6s.length && !network?.hostname) {
    return (
      <section className="glass p-4">
        <div className="flex items-center gap-2">
          <Globe2 className="size-5 text-(--text-muted)" />
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("serverIp")}</h3>
        </div>
        <p className="mt-1.5 text-xs text-(--text-muted)">{t("providerWidgetUnavailable")}</p>
      </section>
    );
  }

  return (
    <section className="glass space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Globe2 className="size-5 text-(--text-muted)" />
        <h3 className="text-sm font-semibold text-(--text-primary)">{t("serverIp")}</h3>
      </div>
      {ipv4s.length > 0 ? <IpGroup label={t("ipv4Label")} ips={ipv4s} /> : null}
      {ipv6s.length > 0 ? <IpGroup label={t("ipv6Label")} ips={ipv6s} /> : null}
      {network?.hostname ? <IpGroup label={t("serverHostname")} ips={[network.hostname]} /> : null}
    </section>
  );
}

function IpGroup({ label, ips }: { label: string; ips: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-muted)">{label}</p>
      {ips.map((ip) => (
        <IpRow key={ip} value={ip} />
      ))}
    </div>
  );
}

function IpRow({ value }: { value: string }) {
  const t = useProviderT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-(--surface-soft) px-3 py-2">
      <span className="min-w-0 break-all font-mono text-xs text-(--text-primary)">{value}</span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? t("providerFieldCopied") : t("providerFieldCopy")}
        title={copied ? t("providerFieldCopied") : t("providerFieldCopy")}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--text-muted) hover:bg-white/10 hover:text-(--text-primary)"
      >
        {copied ? <Check className="size-4 text-(--success)" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
