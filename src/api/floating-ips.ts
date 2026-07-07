import { ResourceClient } from "./resource-client";

export type FloatingIp = {
  id: string;
  address: string;
  ipVersion: number;
  status: string;
  locationId: string;
  locationName: string;
  assignedServiceId: string | null;
  assignedServiceName: string | null;
  monthlyPrice: number;
  nextBillingAt: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};

export type FloatingIpLocationOffer = {
  id: string;
  name: string;
  city?: string;
  countryCode?: string;
  ipv4?: { monthlyPrice: number; available: boolean } | null;
  ipv6?: { monthlyPrice: number; available: boolean } | null;
};

export class FloatingIpsResource extends ResourceClient {
  list() {
    return this.get<{ success: boolean; floatingIps: FloatingIp[] }>("/api/floating-ips");
  }

  options() {
    return this.get<{ success: boolean; locations: FloatingIpLocationOffer[] }>("/api/floating-ips/options");
  }

  order(body: {
    locationId: string;
    ipVersion: 4 | 6;
    billingCycle: number;
    paymentMethod: string;
  }) {
    return this.post<{ success: boolean; floatingIp?: FloatingIp; checkoutUrl?: string }>(
      "/api/floating-ips/order",
      body,
    );
  }

  assign(id: string, serviceId: string) {
    return this.post<{ success: boolean }>(`/api/floating-ips/${encodeURIComponent(id)}/assign`, { serviceId });
  }

  unassign(id: string) {
    return this.post<{ success: boolean }>(`/api/floating-ips/${encodeURIComponent(id)}/unassign`, {});
  }

  cancel(id: string) {
    return this.post<{ success: boolean }>(`/api/floating-ips/${encodeURIComponent(id)}/cancel`, {});
  }
}
