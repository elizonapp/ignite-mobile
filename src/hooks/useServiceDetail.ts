import { useCallback, useEffect, useState } from "react";

import { resolveCaughtApiError } from '../api/resolve-caught-error';
import { mobileTranslate } from '../i18n/mobile-translate';
import { api } from '../lib/api';
import { mapBaseServer, mergeLiveStatus } from '../lib/normalize';
import type { DashboardServer } from '../lib/types';

const POLL_MS = 15_000;

export type ServiceNetwork = {
  primaryIpv4: string | null;
  primaryIpv6: string | null;
  secondaryIps: Array<{ ipAddress: string; ipVersion: 4 | 6 }>;
  hostname: string | null;
};

export type ServiceAccess = {
  canManageBilling?: boolean;
  canEditDetails?: boolean;
  canManageSettings?: boolean;
  isOwner?: boolean;
};

export function useServiceDetail(id: string) {
  const [server, setServer] = useState<DashboardServer | null>(null);
  const [network, setNetwork] = useState<ServiceNetwork | null>(null);
  const [access, setAccess] = useState<ServiceAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (background = false) => {
      if (!background) setIsLoading(true);
      try {
        const data = await api.get<{ success: boolean; server?: Record<string, unknown> }>(`/api/services/${id}`);
        if (!data?.success || !data.server) throw new Error(mobileTranslate("serviceNotFound"));

        const raw = data.server;
        const rawNetwork = raw.network as Record<string, unknown> | undefined;
        const specs = raw.specs as Record<string, unknown> | undefined;
        const os = raw.os as Record<string, unknown> | undefined;

        setAccess((raw.access as ServiceAccess | undefined) ?? null);

        // Store full network for IP display
        const secondaryIps = Array.isArray(rawNetwork?.secondaryIps)
          ? (rawNetwork.secondaryIps as Array<{ ipAddress: string; ipVersion: 4 | 6 }>)
          : [];
        setNetwork({
          primaryIpv4: (rawNetwork?.primaryIpv4 as string | null) ?? null,
          primaryIpv6: (rawNetwork?.primaryIpv6 as string | null) ?? null,
          secondaryIps,
          hostname: (rawNetwork?.hostname as string | null) ?? null,
        });

        // Flatten nested structure for mapBaseServer
        const flat: Record<string, unknown> = {
          ...raw,
          ipv4: rawNetwork?.primaryIpv4 || null,
          ipv6: rawNetwork?.primaryIpv6 || null,
          os: os?.template ?? raw.os ?? "Unknown",
          ram: specs?.ram != null ? Number(specs.ram) / 1024 : (raw.ram ?? 0), // MB → GB
          disk: specs?.disk ?? raw.disk ?? 0,
          cpu: specs?.cpu ?? raw.cpu ?? 1,
          elizonThrottleActive: raw.elizonThrottleActive ?? false,
          elizonThrottledUntil: raw.elizonThrottledUntil ?? null,
          elizonPoolKey: raw.elizonPoolKey ?? null,
          elizonForecastTb: raw.elizonForecastTb ?? null,
        };
        const base = mapBaseServer(flat);
        let merged = base;
        try {
          const status = await api.post<{ success: boolean; statuses: Record<string, Record<string, unknown>> }>(
            "/api/services/status-batch",
            { ids: [id] },
          );
          if (status?.success && status.statuses[id]) {
            const entry = status.statuses[id] as { status?: Record<string, unknown> };
            merged = mergeLiveStatus(base, entry.status ?? status.statuses[id]);
          }
        } catch {
          // keep base data if live status is unavailable
        }
        setServer(merged);
        setError(null);
      } catch (err) {
        setError(resolveCaughtApiError(err, mobileTranslate, "serviceLoadError"));
      } finally {
        if (!background) setIsLoading(false);
      }
    },
    [id],
  );

  useEffect(() => { void refresh(false); }, [refresh]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, POLL_MS);
    return () => window.clearInterval(handle);
  }, [refresh]);

  return { server, network, access, isLoading, error, refresh };
}
