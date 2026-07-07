import { ResourceClient } from "./resource-client";

export class AuthResource extends ResourceClient {
  login(data: { email: string; password: string; twoFactorCode?: string; rememberMe: boolean }) {
    return this.post<{
      success: boolean;
      token?: string;
      user?: unknown;
      error?: string;
      requiresTwoFactor?: boolean;
    }>("/api/auth/login", data);
  }

  me() {
    return this.get<{ success: boolean; user: unknown & { twoFactorEnabled?: boolean } }>("/api/auth/me");
  }

  updateProfile(data: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    phone?: string;
    locale?: string;
    companyName?: string;
    vatNumber?: string;
  }) {
    return this.put<{ success: boolean; error?: string; user?: unknown }>("/api/auth/me", data);
  }

  logout() {
    return this.post<{ success: boolean }>("/api/auth/logout");
  }

  logoutAll() {
    return this.delete<{ success: boolean }>("/api/auth/logout");
  }

  changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.post<{ success: boolean; error?: string }>("/api/auth/change-password", data);
  }

  sessions() {
    return this.get<{ success: boolean; sessions: unknown[] }>("/api/auth/sessions");
  }

  revokeSession(id: string) {
    return this.delete<{ success: boolean }>("/api/auth/sessions", { id });
  }

  setup2fa() {
    return this.get<{ success: boolean; secret: string; otpauthUrl: string; qrCode?: string; error?: string }>(
      "/api/auth/2fa/setup",
    );
  }

  enable2fa(code: string) {
    return this.post<{ success: boolean; backupCodes?: string[]; error?: string }>("/api/auth/2fa/setup", { code });
  }

  disable2fa(code: string, password: string) {
    return this.delete<{ success: boolean; error?: string; twoFactorStillEnabled?: boolean }>(
      "/api/auth/2fa/setup",
      undefined,
      { code, password },
    );
  }

  register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    locale: string;
    vatNumber?: string;
    accountType: string;
    country: string;
    street: string;
    city: string;
    zip: string;
    companyName?: string;
    newsletterOptIn?: boolean;
  }) {
    return this.post<{
      success: boolean;
      token?: string;
      user?: unknown;
      error?: string;
      requiresVerification?: boolean;
      devActivationCode?: string;
    }>("/api/auth/register", data);
  }
}
