import { ResourceClient } from "./resource-client";

export class DomainsResource extends ResourceClient {
  list() {
    return this.get<{ success: boolean; data: Array<{ id: string; domain: string; [key: string]: unknown }> }>("/api/domains");
  }

  add(domain: string) {
    return this.post<{ success: boolean; error?: string }>("/api/domains/add", { domain });
  }

  records(domainId: string) {
    return this.get<{ success: boolean; data: unknown[] }>(`/api/domains/${domainId}/records`);
  }

  createRecord(domainId: string, body: Record<string, unknown>) {
    return this.post<{ success: boolean }>(`/api/domains/${domainId}/records`, body);
  }

  deleteRecord(domainId: string, recordId: string) {
    return this.delete<{ success: boolean }>(`/api/domains/${domainId}/records/${recordId}`);
  }
}
