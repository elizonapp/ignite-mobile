import { ResourceClient } from "./resource-client";

export type ElizonPlusPool = {
  key: string;
  categoryId: string;
  categoryName?: string;
  locationId: string;
  locationName?: string;
  memberCount: number;
  includedTb: number;
  usedTb: number;
  remainingTb: number;
};

export type ElizonPlusStatusResponse = {
  success?: boolean;
  elizonPlusActive: boolean;
  isAdminGrant?: boolean;
  subscription: {
    status: string;
    basePriceGross: number;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    failedAttempts: number;
    isAdminGrant: boolean;
  } | null;
  pooling?: {
    enabled: boolean;
    mode: "THROTTLE";
    pools: ElizonPlusPool[];
  };
  forecast?: Array<{
    key: string;
    projectedRemainingTb: number;
    projectedPeriodEndUsageTb: number;
    last24hUsageTb: number;
  }>;
  savings?: {
    currentPeriodGross: number;
    lifetimeGross: number;
    pooledCostGross: number;
    unpooledCostGross: number;
  };
};

export class ElizonPlusResource extends ResourceClient {
  status() {
    return this.get<ElizonPlusStatusResponse>("/api/elizon-plus/status");
  }

  subscribe(paymentMethod: "mollie" | "guthaben" = "mollie") {
    return this.post<{ success: boolean; checkoutUrl?: string; error?: string }>(
      "/api/elizon-plus/subscribe",
      { paymentMethod },
    );
  }

  cancel() {
    return this.post<{ success: boolean; error?: string }>("/api/elizon-plus/cancel");
  }

  reactivate() {
    return this.post<{ success: boolean; error?: string }>("/api/elizon-plus/reactivate");
  }

  updatePooling(enabled: boolean) {
    return this.put<{ success: boolean; error?: string }>("/api/elizon-plus/pooling", {
      enabled,
      mode: "THROTTLE",
    });
  }
}
