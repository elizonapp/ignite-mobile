import { ResourceClient } from "./resource-client";

export class PublicResource extends ResourceClient {
  registrationStatus() {
    return this.get<{
      success: boolean;
      allowRegistration?: boolean;
      allowRegistrationPrivate?: boolean;
      allowRegistrationBusiness?: boolean;
    }>("/api/public/registration-status");
  }

  countries() {
    return this.get<{
      success: boolean;
      countries?: Array<{
        countryCode: string;
        countryName: string;
        taxRate: number;
        taxName: string;
        isDefault: boolean;
      }>;
    }>("/api/public/countries");
  }

  supportStats() {
    return this.get<{
      success: boolean;
      stats?: {
        avgFirstResponseMinutes: number | null;
        medianFirstResponseMinutes: number | null;
      };
    }>("/api/public/support-stats");
  }
}
