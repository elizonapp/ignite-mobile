import { ResourceClient } from "./resource-client";

export class SubdomainsResource extends ResourceClient {
  list() {
    return this.get<{ success: boolean; data: unknown[]; limitUsed: number; limitMax: number }>("/api/subdomains");
  }

  allowedDomains() {
    return this.get<{ success: boolean; data: unknown[] }>("/api/subdomains/domains");
  }

  create(body: Record<string, unknown>) {
    return this.post<{ success: boolean; error?: string }>("/api/subdomains", body);
  }

  delete(id: string) {
    return this.delete<{ success: boolean }>(`/api/subdomains/${id}`);
  }
}
