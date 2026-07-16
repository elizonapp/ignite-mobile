import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { useI18n } from "../../i18n";
import { cn } from "../../lib/utils";
import type { DashboardServer, ServerStatus } from "../../lib/types";
import { IconChevronRight, IconGlobe, IconMapPin } from "./dashboard-icons";

const dotClass: Record<ServerStatus, string> = {
  online: "bg-(--success)",
  offline: "bg-(--text-muted)",
  starting: "bg-(--warning) animate-pulse",
  stopping: "bg-(--warning) animate-pulse",
};

const statusBadgeVariant: Record<ServerStatus, "success" | "muted" | "warning"> = {
  online: "success",
  offline: "muted",
  starting: "warning",
  stopping: "warning",
};

export function ServerCard({
  server,
  onOpen,
  maintenance,
}: {
  server: DashboardServer;
  onOpen: (id: string) => void;
  maintenance?: boolean;
}) {
  const { t } = useI18n();
  const isPloi = (server.providerType || "").toUpperCase() === "PLOI";
  const displayIp = isPloi
    ? server.ploiStats?.domain || server.providerAddress || server.ip
    : server.ip;
  const ramPct = server.ram.total > 0 ? Math.round((server.ram.used / server.ram.total) * 100) : 0;
  const diskPct = server.disk.total > 0 ? Math.round((server.disk.used / server.disk.total) * 100) : 0;
  const cpuPct = Math.min(100, Math.max(0, +server.cpu.used.toFixed(1)));
  const ramLabel = server.ram.total > 0 ? `${server.ram.used.toFixed(1)} / ${server.ram.total.toFixed(1)} GB` : "—";
  const diskLabel = server.disk.total > 0
    ? server.disk.used > 0 ? `${server.disk.used.toFixed(1)} / ${server.disk.total.toFixed(1)} GB` : `${server.disk.total.toFixed(1)} GB`
    : "—";
  const storageStatus = server.ploiStats?.storageStatus ?? "unknown";
  const storageTone =
    storageStatus === "exceeded" ? "danger" : storageStatus === "warning" ? "warning" : "success";

  const statusLabel: Record<ServerStatus, string> = {
    online: t("serverOnline"),
    offline: t("serverOffline"),
    starting: t("serverStarting"),
    stopping: t("serverStopping"),
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(server.id)}
      className="glass glass-hover w-full p-4 text-left active:scale-[0.99]"
      aria-label={`Open ${server.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", dotClass[server.status])} aria-hidden />
            <span className="truncate text-sm font-semibold text-(--text-primary)">{server.name}</span>
            {server.isShared && <Badge variant="outline">{t("serverShared")}</Badge>}
            {server.suspendedAt && <Badge variant="danger">{t("serverSuspended")}</Badge>}
            {server.terminationPending && <Badge variant="warning">{t("serviceDeleting")}</Badge>}
            {server.reinstallPending && <Badge variant="warning">{t("serverReinstallPending")}</Badge>}
            {maintenance && <Badge variant="warning">{t("serverMaintenance")}</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--text-muted)">
            <span className="inline-flex items-center gap-1">
              <IconMapPin className="h-4 w-4 shrink-0" /> {server.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconGlobe className="h-4 w-4 shrink-0" /> {displayIp}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={statusBadgeVariant[server.status]}>{statusLabel[server.status]}</Badge>
          <IconChevronRight className="h-4 w-4 text-(--text-muted)" />
        </div>
      </div>

      {(storageStatus === "exceeded" || storageStatus === "warning") && isPloi && (
        <div
          className={cn(
            "mt-3 rounded-lg border px-3 py-2 text-xs",
            storageStatus === "exceeded"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          )}
        >
          {storageStatus === "exceeded" ? t("ploiStorageExceededBanner") : t("ploiStorageWarningBanner")}
        </div>
      )}

      {isPloi && server.ploiStats?.dnsStatus === "missing" && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t("ploiDnsMissingBanner")}
        </div>
      )}

      {isPloi ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-(--text-muted)">{t("ploiStorage")}</span>
            <span className="font-medium text-(--text-primary)">{diskLabel}</span>
          </div>
          <Progress className="mt-1 h-1.5" value={diskPct} tone={storageTone} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label={t("serverCpu")} value={`${cpuPct}%`} pct={cpuPct} tone="primary" />
          <Metric label={t("serverRam")} value={ramLabel} pct={ramPct} tone="primary" />
          <Metric label={t("serverDisk")} value={diskLabel} pct={diskPct} tone="success" />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm text-(--text-muted)">
        <span className="truncate pr-2">{isPloi ? (server.ploiStats?.locationLabel || server.location) : server.os}</span>
        {!isPloi && (
          <span className="whitespace-nowrap">
            {t("serverUptime")} · {server.uptime}
          </span>
        )}
      </div>
    </button>
  );
}

function Metric({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: "primary" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-(--text-muted)">{label}</span>
        <span className="font-medium text-(--text-primary)">{value}</span>
      </div>
      <Progress className="mt-1 h-1.5" value={pct} tone={tone} />
    </div>
  );
}
