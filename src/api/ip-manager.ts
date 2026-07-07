import { ResourceClient } from "./resource-client";

export class IpManagerResource extends ResourceClient {
  list() {
    return this.get<{ success: boolean; data?: unknown[]; subnets?: unknown[]; error?: string }>("/api/ip-manager");
  }

  update(id: string, body: Record<string, unknown>) {
    return this.patch<{ success: boolean }>(`/api/ip-manager/${id}`, body);
  }

  delete(id: string) {
    return this.delete<{ success: boolean }>(`/api/ip-manager/${id}`);
  }

  addIpv6(body: { serviceId: string; ipv6Address: string }) {
    return this.post<{ success: boolean; error?: string }>("/api/ip-manager", body);
  }
}
