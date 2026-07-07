import { useCallback, useEffect, useState } from "react";

import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { mobileTranslate } from "../i18n/mobile-translate";
import { api } from "../lib/api";
import { mapBaseServer } from "../lib/normalize";
import type { DashboardServer, MaintenanceNote } from "../lib/types";

const SERVICE_LIMIT = 50;

type State = {
  isLoading: boolean;
  error: string | null;
  servers: DashboardServer[];
  maintenance: MaintenanceNote[];
};

const emptyState: State = {
  isLoading: true,
  error: null,
  servers: [],
  maintenance: [],
};

function mobileTranslateForHook(key: string): string {
  return mobileTranslate(key);
}

export function useServersList() {
  const [state, setState] = useState<State>(emptyState);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const [servicesData, maintenanceData] = await Promise.all([
        api.services.list(SERVICE_LIMIT),
        api.dashboard.maintenanceNotifications().catch(() => null),
      ]);

      if (!servicesData?.success) {
        throw new Error(resolveApiError(servicesData, mobileTranslateForHook, { fallbackKey: "serversLoadError" }));
      }

      const raw = servicesData.servers ?? servicesData.services ?? [];
      const servers = (raw as Record<string, unknown>[]).map(mapBaseServer);

      const maintenance: MaintenanceNote[] =
        maintenanceData?.success && Array.isArray(maintenanceData.notifications)
          ? maintenanceData.notifications.map((n) => ({
              id: String(n.id ?? ""),
              serviceId: String(n.serviceId ?? ""),
              serviceName: String(n.serviceName ?? ""),
              startDate: typeof n.startDate === "string" ? n.startDate : null,
              endDate: typeof n.endDate === "string" ? n.endDate : null,
              title: typeof n.title === "string" ? n.title : null,
              description: typeof n.description === "string" ? n.description : null,
            }))
          : [];

      setState({ isLoading: false, error: null, servers, maintenance });
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: resolveCaughtApiError(err, mobileTranslateForHook, "serversLoadError"),
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
