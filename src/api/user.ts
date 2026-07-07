import { ResourceClient } from "./resource-client";

export type SupportPinState = {
  supportPin: string | null;
  pinExpiresAt: string | null;
  pinTimeLeft: number | null;
  pinCooldown: number | null;
};

type SupportPinApiResponse = {
  success?: boolean;
  pin?: string | null;
  expiresAt?: string | null;
};

function mapSupportPinResponse(data: SupportPinApiResponse): SupportPinState {
  const pinExpiresAt = typeof data.expiresAt === "string" ? data.expiresAt : null;
  const pinTimeLeft = pinExpiresAt
    ? Math.max(0, Math.floor((new Date(pinExpiresAt).getTime() - Date.now()) / 1000))
    : null;

  return {
    supportPin: typeof data.pin === "string" ? data.pin : null,
    pinExpiresAt,
    pinTimeLeft: pinTimeLeft && pinTimeLeft > 0 ? pinTimeLeft : null,
    pinCooldown: null,
  };
}

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
    return this.get<SupportPinApiResponse>("/api/user/support-pin").then(mapSupportPinResponse);
  }

  generateSupportPin() {
    return this.post<SupportPinApiResponse>("/api/user/support-pin").then(mapSupportPinResponse);
  }
}
