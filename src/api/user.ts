import { ResourceClient } from "./resource-client";

export class UserResource extends ResourceClient {
  auditLog(limit = 50) {
    return this.get<{ success: boolean; logs: unknown[] }>("/api/user/audit-log", { limit });
  }

  gdprExportCheck() {
    return this.delete<{ success: boolean; warnings?: string[] }>("/api/user/gdpr-export");
  }

  gdprExportConfirm(password: string) {
    return this.delete<{ success: boolean }>("/api/user/gdpr-export", { confirm: "true" }, { password });
  }

  apiKeys(page = 1, pageSize = 50) {
    return this.get<{ success: boolean; apiKeys: unknown[]; total?: number }>("/api/api-keys", { page, pageSize });
  }

  createApiKey(name: string) {
    return this.post<{ success: boolean; apiKey: unknown; secret: string }>("/api/api-keys", { name });
  }

  revokeApiKey(id: string) {
    return this.delete<{ success: boolean }>("/api/api-keys", { id });
  }

  supportPin() {
    return this.get<{
      supportPin: string | null;
      pinExpiresAt: string | null;
      pinTimeLeft: number | null;
      pinCooldown: number | null;
    }>("/api/user/support-pin");
  }

  generateSupportPin() {
    return this.post<{
      supportPin: string | null;
      pinExpiresAt: string | null;
      pinTimeLeft: number | null;
      pinCooldown: number | null;
    }>("/api/user/support-pin");
  }
}
