import { useCallback, useEffect, useState } from "react";

import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useAuth } from "../components/AuthProvider";
import { mobileTranslate } from "../i18n/mobile-translate";
import { api } from "../lib/api";
import { shouldShowTrafficPoolingUi } from "../lib/elizon-plus";
import { mapBaseServer, normalizeStatus } from "../lib/normalize";
import type { DashboardServer, DashboardStats, MaintenanceNote } from "../lib/types";

const SERVICE_LIMIT = 50;
const REFRESH_MS = 30_000;

export type TrafficSourceSummary = {
  walletBalanceTb: number;
  walletUsedTb: number;
  serviceSourceCounts: { SERVICE: number; POOL: number; WALLET: number };
};

export type MonthlyOfferTeaser = {
  id: string;
  productName: string;
  productSlug: string | null;
  discountPercent: number;
  expiresAt: string;
};

type State = {
  isLoading: boolean;
  error: string | null;
  servers: DashboardServer[];
  stats: DashboardStats;
  maintenance: MaintenanceNote[];
  trafficSourceSummary: TrafficSourceSummary | null;
  monthlyOffers: MonthlyOfferTeaser[];
};

const emptyState: State = {
  isLoading: true,
  error: null,
  servers: [],
  stats: { totalServers: 0, activeServers: 0, totalBandwidth: 0, openTickets: 0 },
  maintenance: [],
  trafficSourceSummary: null,
  monthlyOffers: [],
};

export function useDashboardData() {
  const [state, setState] = useState<State>(emptyState);
  const { user } = useAuth();

  const load = useCallback(async (background = false) => {
    if (!background) setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const showTrafficUi = shouldShowTrafficPoolingUi(user);
      const [serversData, ticketsData, bandwidthData, maintenanceData, trafficData, offersData] = await Promise.all([
        api.dashboard.services(SERVICE_LIMIT),
        api.dashboard.tickets("open", 1).catch(() => null),
        api.dashboard.totalBandwidth().catch(() => null),
        api.dashboard.maintenanceNotifications().catch(() => null),
        showTrafficUi ? api.dashboard.trafficSources().catch(() => null) : Promise.resolve(null),
        api.dashboard.monthlyOffers().catch(() => null),
      ]);

      if (!serversData?.success) {
        throw new Error(resolveApiError(serversData, mobileTranslate, { fallbackKey: "unknownError" }));
      }

      const servers = (serversData.servers ?? []).map(mapBaseServer);
      const totalServers = serversData.pagination?.total ?? servers.length;
      const activeServers = (serversData.servers ?? []).filter((s) => normalizeStatus(s.status) === "online").length;
      const totalBandwidth = bandwidthData?.success ? bandwidthData.usage?.totalGb ?? 0 : 0;
      const openTickets = ticketsData?.success ? ticketsData.pagination?.total ?? 0 : 0;

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

      const trafficSourceSummary =
        showTrafficUi && trafficData?.success && trafficData.summary
          ? (trafficData.summary as TrafficSourceSummary)
          : null;

      const monthlyOffers: MonthlyOfferTeaser[] =
        offersData?.success && Array.isArray(offersData.offers)
          ? offersData.offers.map((offer) => {
              const row = offer as Record<string, unknown>;
              return {
                id: String(row.id ?? ""),
                productName: String(row.productName ?? row.productId ?? "Produkt"),
                productSlug: typeof row.productSlug === "string" ? row.productSlug : null,
                discountPercent: Number(row.discountPercent ?? 0),
                expiresAt: String(row.expiresAt ?? ""),
              };
            })
          : [];

      setState({
        isLoading: false,
        error: null,
        servers,
        stats: { totalServers, activeServers, totalBandwidth, openTickets },
        maintenance,
        trafficSourceSummary,
        monthlyOffers,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: resolveCaughtApiError(err, mobileTranslate, "dashboardLoadError"),
      }));
    }
  }, [user?.elizonPlusCustomerUiVisible]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (state.isLoading || state.error) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const handle = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(handle);
  }, [state.isLoading, state.error, load]);

  return { ...state, reload: () => load(false) };
}
