import { ResourceClient } from "./resource-client";

export class AffiliatesResource extends ResourceClient {
  me() {
    return this.get<{ success: boolean }>("/api/affiliates/me");
  }

  validate(code: string) {
    return this.post<{ success: boolean; affiliate?: { code: string; name: string } }>(
      "/api/affiliates/validate",
      { code },
    );
  }

  commissions(limit = 50) {
    return this.get<{ success: boolean; commissions?: unknown[] }>("/api/affiliates/me/commissions", { limit });
  }

  payoutRequests(limit = 20, offset = 0) {
    return this.get<{ success: boolean; requests: unknown[]; total: number }>(
      "/api/affiliates/me/payout-requests",
      { limit, offset },
    );
  }

  taxInfo() {
    return this.get<{ success: boolean; taxInfo: unknown | null; profile?: unknown }>(
      "/api/affiliates/me/tax-info",
    );
  }
}
