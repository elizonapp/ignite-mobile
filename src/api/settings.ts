import { ResourceClient } from "./resource-client";

export type UserAddress = {
  id: string;
  label?: string | null;
  isDefault?: boolean;
  companyName?: string | null;
  vatId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  street: string;
  zip: string;
  city: string;
  countryCode?: string | null;
  country: string;
  phone?: string | null;
};

export type UserSettingsPatch = {
  loginNotificationEmailOptIn?: boolean;
  emailNotifications?: boolean;
  notificationSoundEnabled?: boolean;
  servicePowerActionEmailOptIn?: boolean;
};

export class SettingsResource extends ResourceClient {
  addresses() {
    return this.get<{ success: boolean; addresses: UserAddress[] }>("/api/addresses");
  }

  createAddress(body: Record<string, unknown>) {
    return this.post<{ success: boolean; address?: UserAddress }>("/api/addresses", body);
  }

  updateAddress(body: Record<string, unknown>) {
    return this.put<{ success: boolean; address?: UserAddress }>("/api/addresses", body);
  }

  deleteAddress(id: string) {
    return this.delete<{ success: boolean }>("/api/addresses", { id });
  }

  countries() {
    return this.get<{
      success: boolean;
      countries?: Array<{ countryCode: string; countryName: string; isDefault?: boolean }>;
    }>("/api/public/countries");
  }

  patchUserSettings(body: UserSettingsPatch) {
    return this.patch<{ success: boolean; user?: Record<string, unknown> }>("/api/user/settings", body);
  }

  newsletterSubscribe() {
    return this.post<{ success: boolean }>("/api/user/newsletter-settings", { subscribe: true });
  }

  discordState() {
    return this.get<{
      success: boolean;
      linked?: boolean;
      discord?: { discordUserId: string } | null;
      allowThirdPartySupport?: boolean;
      supportConsent?: boolean;
      publicRoleConsent?: boolean;
    }>("/api/user/discord");
  }

  linkDiscord(token: string) {
    return this.post<{ success: boolean }>("/api/user/discord", { token });
  }

  unlinkDiscord() {
    return this.delete<{ success: boolean }>("/api/user/discord");
  }

  patchDiscord(body: Record<string, unknown>) {
    return this.patch<{ success: boolean }>("/api/user/discord", body);
  }

  ssoState() {
    return this.get<{
      success: boolean;
      eligible?: boolean;
      isBusiness?: boolean;
      accountLinks?: Array<{ id: string; domain: string; displayName: string | null; externalEmail: string | null }>;
      assignedProviders?: Array<{ id: string; domain: string; displayName: string | null; verified: boolean }>;
    }>("/api/user/sso");
  }

  dpaOverview() {
    return this.get<{
      success: boolean;
      active?: boolean;
      documents?: Array<{ id: string; fileName: string; status: string; createdAt: string; retainUntil?: string | null }>;
    }>("/api/user/dpa");
  }

  idVerificationEnforcement() {
    return this.get<{ success: boolean; required?: boolean; status?: string | null }>(
      "/api/user/id-verification/enforcement-status",
    );
  }
}
