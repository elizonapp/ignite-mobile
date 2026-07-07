import { ResourceClient } from "./resource-client";

export class DashboardResource extends ResourceClient {
  services(limit = 50) {
    return this.get<{ success: boolean; servers: Record<string, unknown>[]; pagination?: { total: number } }>(
      "/api/services",
      { limit },
    );
  }

  tickets(status = "open", limit = 1) {
    return this.get<{ success: boolean; pagination?: { total: number } }>("/api/tickets", {
      status,
      limit,
    });
  }

  totalBandwidth() {
    return this.get<{ success: boolean; usage?: { totalGb?: number } }>("/api/services/total-bandwidth");
  }

  maintenanceNotifications() {
    return this.get<{ success: boolean; notifications?: Record<string, unknown>[] }>(
      "/api/services/maintenance-notifications",
    );
  }

  trafficSources() {
    return this.get<{
      success: boolean;
      summary?: {
        walletBalanceTb: number;
        walletUsedTb: number;
        serviceSourceCounts: { SERVICE: number; POOL: number; WALLET: number };
      };
      serviceSources?: unknown[];
    }>("/api/dashboard/traffic-sources");
  }

  monthlyOffers() {
    return this.get<{ success: boolean; offers?: unknown[] }>("/api/user/monthly-offers");
  }
}
