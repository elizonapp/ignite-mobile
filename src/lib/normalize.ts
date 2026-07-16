import type { DashboardServer, ServerStatus } from "./types";

export function normalizeStatus(value: unknown): ServerStatus {
  const v = String(value ?? "").toLowerCase();
  if (v === "active" || v === "online" || v === "running") return "online";
  if (v === "starting" || v === "provisioning" || v === "booting") return "starting";
  if (v === "stopping" || v === "suspending") return "stopping";
  return "offline";
}

export function formatUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const BYTES_PER_GIB = 1024 ** 3;
const MEBI_PER_GIB = 1024;

/** Ported from web app's liveMetrics.ts — returns 0 (not fallback) for invalid/zero values. */
export function normalizeResourceToGb(value: unknown, referenceTotalGb = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1024 * 1024) return +(n / BYTES_PER_GIB).toFixed(1);  // bytes → GB
  if (referenceTotalGb > 0) {
    if (n <= referenceTotalGb * 1.5) return +n.toFixed(1);        // already GB
    const mib = n / MEBI_PER_GIB;
    if (mib <= referenceTotalGb * 1.5) return +mib.toFixed(1);   // MiB → GB
  }
  if (n >= MEBI_PER_GIB) return +(n / MEBI_PER_GIB).toFixed(1); // MiB → GB
  return +n.toFixed(1);
}

export function normalizeCpuUsageToPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const pct = n <= 1 ? n * 100 : n;
  return Math.min(100, Math.max(0, pct));
}

export function mapBaseServer(raw: Record<string, unknown>): DashboardServer {
  const ipv4 = typeof raw.ipv4 === "string" ? raw.ipv4 : null;
  const ipv6 = typeof raw.ipv6 === "string" ? raw.ipv6 : null;
  return {
    id: String(raw.id ?? ""),
    name: typeof raw.name === "string" ? raw.name : String(raw.name ?? "Unknown"),
    userDisplayName: (raw.userDisplayName as string | null) ?? null,
    status: normalizeStatus(raw.status),
    ip: ipv4 ?? ipv6 ?? "—",
    location: typeof raw.location === "string" ? raw.location : "—",
    os:
      typeof raw.os === "string"
        ? raw.os
        : typeof raw.hostname === "string"
        ? raw.hostname
        : "Unknown",
    cpu: { used: 0, total: 100 },
    ram: { used: 0, total: Number(raw.ram) || 0 },
    disk: { used: 0, total: Number(raw.disk) || 0 },
    bandwidth: { used: 0, total: Number(raw.bandwidth) || 0 },
    uptime: "—",
    suspendedAt: (raw.suspendedAt as string | null) ?? null,
    providerType: (raw.providerType as string | null) ?? null,
    isShared: Boolean(raw.isShared),
    sharedByName: (raw.sharedByName as string | null) ?? null,
    elizonThrottleActive: Boolean(raw.elizonThrottleActive),
    elizonThrottledUntil: (raw.elizonThrottledUntil as string | null) ?? null,
    elizonPoolKey: (raw.elizonPoolKey as string | null) ?? null,
    elizonForecastTb: typeof raw.elizonForecastTb === "number" ? raw.elizonForecastTb : null,
    suspendReason: (raw.suspendReason as string | null) ?? null,
    terminationPending: Boolean(raw.terminationPending),
    reinstallPending: Boolean(raw.reinstallPending),
  };
}

export function mergeLiveStatus(server: DashboardServer, status: Record<string, unknown> | null | undefined): DashboardServer {
  if (!status) return server;
  const cpuPct = normalizeCpuUsageToPercent((status.cpu as { usage?: unknown } | undefined)?.usage);
  const totalRam =
    normalizeResourceToGb((status.memory as { total?: unknown } | undefined)?.total, server.ram.total) ||
    server.ram.total;
  const usedRam = normalizeResourceToGb((status.memory as { used?: unknown } | undefined)?.used, totalRam);
  const totalDisk =
    server.disk.total ||
    normalizeResourceToGb((status.disk as { total?: unknown } | undefined)?.total, server.disk.total);
  const usedDisk = normalizeResourceToGb((status.disk as { used?: unknown } | undefined)?.used, totalDisk);

  const monthlyBytes = (status.bandwidthUsage as { monthlyTotalBytes?: number } | undefined)?.monthlyTotalBytes;
  const networkIn = Number((status.network as { in?: unknown } | undefined)?.in) || 0;
  const networkOut = Number((status.network as { out?: unknown } | undefined)?.out) || 0;
  const bandwidthGb = monthlyBytes
    ? +(monthlyBytes / (1024 ** 3)).toFixed(1)
    : normalizeResourceToGb(networkIn + networkOut);

  const uptimeSeconds = Number((status as { uptime?: unknown }).uptime) || 0;

  return {
    ...server,
    status: normalizeStatus((status as { status?: unknown }).status ?? server.status),
    cpu: { used: cpuPct, total: 100 },
    ram: { used: usedRam, total: totalRam },
    disk: { used: usedDisk, total: totalDisk },
    bandwidth: { used: bandwidthGb, total: server.bandwidth.total },
    uptime: formatUptime(uptimeSeconds),
    uptimeSeconds,
  };
}
