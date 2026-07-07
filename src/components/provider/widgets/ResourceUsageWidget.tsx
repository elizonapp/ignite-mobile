import { Cpu, Database, HardDrive, Wifi } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Progress } from "../../ui/progress";
import { useProviderT } from "../use-provider-t";
import type { ProviderWidgetProps } from "../types";

/**
 * Mobile port of the web "resource-usage" widget. The heavy recharts sparkline
 * variant is desktop-only; on mobile we render compact CPU / RAM / disk /
 * bandwidth usage bars from the already-merged live status on the server model.
 */
export default function ResourceUsageWidget({ context }: ProviderWidgetProps) {
  const t = useProviderT();
  const server = context?.server;
  if (!server) return null;

  const cpuPct = Math.min(100, Math.max(0, +server.cpu.used.toFixed(1)));
  const ramPct = server.ram.total > 0 ? Math.round((server.ram.used / server.ram.total) * 100) : 0;
  const diskPct = server.disk.total > 0 ? Math.round((server.disk.used / server.disk.total) * 100) : 0;
  const bwPct = server.bandwidth.total > 0 ? Math.round((server.bandwidth.used / server.bandwidth.total) * 100) : 0;

  const ramLabel = server.ram.total > 0 ? `${server.ram.used.toFixed(1)} / ${server.ram.total.toFixed(1)} GB` : "—";
  const diskLabel =
    server.disk.total > 0
      ? server.disk.used > 0
        ? `${server.disk.used.toFixed(1)} / ${server.disk.total.toFixed(1)} GB`
        : `${server.disk.total.toFixed(1)} GB`
      : "—";

  return (
    <section className="glass p-4">
      <h3 className="text-sm font-semibold text-(--text-primary)">{t("resourceUsage")}</h3>
      <div className="mt-3 space-y-3">
        <ResourceBar icon={Cpu} label={t("serverCpu")} value={`${cpuPct}%`} pct={cpuPct} tone="primary" />
        <ResourceBar icon={Database} label={t("serverRam")} value={ramLabel} pct={ramPct} tone="primary" />
        <ResourceBar icon={HardDrive} label={t("serverDisk")} value={diskLabel} pct={diskPct} tone="success" />
        {server.bandwidth.total > 0 ? (
          <ResourceBar
            icon={Wifi}
            label={t("serverBandwidth")}
            value={`${server.bandwidth.used.toFixed(1)} / ${server.bandwidth.total.toFixed(1)} GB`}
            pct={bwPct}
            tone="primary"
          />
        ) : null}
      </div>
    </section>
  );
}

function ResourceBar({
  icon: Icon,
  label,
  value,
  pct,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  pct: number;
  tone: "primary" | "success";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-(--text-muted)">
          <Icon className="size-3.5" /> {label}
        </span>
        <span className="font-medium text-(--text-primary)">{value}</span>
      </div>
      <Progress className="mt-1.5" value={pct} tone={tone} />
    </div>
  );
}
