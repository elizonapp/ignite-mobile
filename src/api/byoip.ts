import { ResourceClient } from "./resource-client";

export type ByoipAssignment = {
  id: string;
  assignedPrefix: string;
  prefixVersion?: number;
  isPrimary: boolean;
  note?: string | null;
  createdAt?: string;
  service: { id: string; name: string } | null;
};

export type ByoipNetwork = {
  id: string;
  prefix: string;
  prefixVersion: number;
  asnNumber: string | null;
  description: string | null;
  status: string;
  locationId: string | null;
  setupFeeGross: number;
  monthlyFeeGross: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isAdminGrant?: boolean;
  ddosProtectionProvider: string;
  ddosMigrationRequestedAt?: string | null;
  ddosMigrationRequestedProvider?: string | null;
  tbWalletBalanceTb: number;
  tbWalletUsedTb: number;
  createdAt: string;
  assignments: ByoipAssignment[];
};

export type ByoipDdosMarketing = {
  standardProviderName: string;
  premiumDisplayName: string;
  premiumProviderKey: string;
  premiumVisible: boolean;
};

export type ByoipStatusResponse = {
  success: boolean;
  networks: ByoipNetwork[];
  allowedLocationIds: string[];
  walletPricePerTbGross: number;
  ddosMarketing?: ByoipDdosMarketing;
};

export class ByoipResource extends ResourceClient {
  status() {
    return this.get<ByoipStatusResponse>("/api/byoip/status");
  }

  apply(formData: FormData) {
    return this.post<{ success: boolean }>("/api/byoip/apply", formData);
  }

  assign(body: { networkId: string; serviceId: string; prefix: string; isPrimary?: boolean; note?: string }) {
    return this.post<{ success: boolean }>("/api/byoip/assign", body);
  }

  unassign(assignmentId: string) {
    return this.delete<{ success: boolean }>(`/api/byoip/assign/${encodeURIComponent(assignmentId)}`);
  }

  subscribe(networkId: string, paymentMethod?: "guthaben" | "mollie") {
    return this.post<{ success: boolean; checkoutUrl?: string; paidWithBalance?: boolean }>(
      "/api/byoip/subscribe",
      { networkId, paymentMethod },
    );
  }

  cancel(networkId: string) {
    return this.post<{ success: boolean }>("/api/byoip/cancel", { networkId });
  }

  walletTopup(networkId: string, tb: number, paymentMethod: "guthaben" | "mollie" = "guthaben") {
    return this.post<{ success: boolean }>("/api/byoip/wallet", { networkId, tb, paymentMethod });
  }

  requestPremiumDdosMigration(networkId: string) {
    return this.post<{ success: boolean }>("/api/byoip/migration/request", { networkId });
  }

  requestDeannouncement(networkId: string) {
    return this.post<{ success: boolean; alreadyRequested?: boolean }>("/api/byoip/deannouncement/request", {
      networkId,
    });
  }
}
