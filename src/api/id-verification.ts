import { ResourceClient } from "./resource-client";

export const ENJYN_LINK_SESSION_TTL_MS = 30 * 60 * 1000;

export type IdVerificationAddress = {
  id: string;
  label: string | null;
  isDefault: boolean;
  firstName: string | null;
  lastName: string | null;
  street: string;
  zip: string;
  city: string;
  countryCode: string;
  country: string;
};

export type IdVerificationDocumentType = {
  id: string;
  label: string;
  documentType: string;
  enjynEnabled: boolean;
};

export type IdVerificationCountry = {
  countryCode: string;
  label: string;
  documentTypes: IdVerificationDocumentType[];
};

export type IdVerificationRecord = {
  id: string;
  method: string;
  status: string;
  requestedByAdminId: string | null;
  relatedCaseReportId?: string | null;
  consentGiven?: boolean;
  verificationFirstName: string;
  verificationLastName: string;
  submittedDateOfBirth: string;
  addressStreet: string;
  addressZip: string;
  addressCity: string;
  addressCountryCode: string;
  enjynCallbackPayload?: {
    countryCode?: string;
    documentTypeId?: string;
    documentType?: string;
    verifyUrl?: string;
    qrUrl?: string;
    enjynToken?: string;
    enjynStatus?: string;
    enjynSessionCreatedAt?: string;
    enjynSessionStartError?: string;
  } | null;
  selfieDataEnc?: string | null;
  hasImages?: boolean;
  createdAt?: string;
};

export type IdVerificationStatusResponse = {
  success?: boolean;
  user: {
    identVerified: boolean;
    dobCorrectionUsedAt: string | null;
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
  } | null;
  pending: IdVerificationRecord | null;
  verified: IdVerificationRecord | null;
  verificationCountries: IdVerificationCountry[];
  dobCorrectionAvailable: boolean;
};

export type IdVerificationEnjynCallbackResponse = IdVerificationStatusResponse & {
  outcome?: "verified" | "failed" | "expired" | "processing" | "pending" | "none";
};

export class IdVerificationResource extends ResourceClient {
  status() {
    return this.get<IdVerificationStatusResponse>("/api/user/id-verification/status");
  }

  enforcementStatus() {
    return this.get<{ success: boolean; required?: boolean; status?: string | null }>(
      "/api/user/id-verification/enforcement-status",
    );
  }

  enjynCallback(sessionId?: string) {
    return this.post<IdVerificationEnjynCallbackResponse>("/api/user/id-verification/enjyn-callback", {
      sessionId: sessionId || undefined,
    });
  }

  start(body: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    addressId: string;
    addressStreet: string;
    addressZip: string;
    addressCity: string;
    addressCountryCode: string;
    explicitConsent: boolean;
  }) {
    return this.post<{ success: boolean; verification: { id: string } }>(
      "/api/user/id-verification/start",
      body,
    );
  }

  selectMethod(
    verificationId: string,
    body: { countryCode: string; documentTypeId: string; explicitConsent?: boolean },
  ) {
    return this.post<{ success: boolean; verification: { method: string } }>(
      `/api/user/id-verification/${encodeURIComponent(verificationId)}/method`,
      body,
    );
  }

  enjynStart(verificationId: string, body?: { explicitConsent?: boolean }) {
    return this.post<{ success: boolean }>(
      `/api/user/id-verification/${encodeURIComponent(verificationId)}/enjyn-start`,
      body ?? {},
    );
  }

  enjynRestart(verificationId: string, body?: { explicitConsent?: boolean }) {
    return this.post<{ success: boolean }>(
      `/api/user/id-verification/${encodeURIComponent(verificationId)}/enjyn-restart`,
      body ?? {},
    );
  }

  upload(verificationId: string, formData: FormData) {
    return this.post<{ success: boolean }>(
      `/api/user/id-verification/${encodeURIComponent(verificationId)}/upload`,
      formData,
    );
  }

  decline(verificationId: string) {
    return this.post<{ success: boolean }>(
      `/api/user/id-verification/${encodeURIComponent(verificationId)}/decline`,
    );
  }
}
