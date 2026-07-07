import { ResourceClient } from "./resource-client";

export type BusinessFundContract = {
  id: string;
  commitmentAmount: number;
  price: number;
  overchargeFeePercent: number;
  bindingMonths: number;
  bindingEndDate: string | null;
  status: string;
  currentUsage: number;
  currentOvercharge: number;
  lastResetAt: string | null;
};

export type BusinessFundOffer = {
  id: string;
  commitmentAmount: number;
  price: number;
  overchargeFeePercent: number;
  bindingMonths: number;
  adminNote: string | null;
  offeredAt: string;
};

export type BusinessFundStatusResponse = {
  success: boolean;
  contract: BusinessFundContract | null;
  pendingOffer: BusinessFundOffer | null;
};

export type BusinessVerificationRecord = {
  id: string;
  status: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | string;
  adminComment: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  createdAt?: string;
};

export type BusinessVerificationResponse = {
  success: boolean;
  verification: BusinessVerificationRecord | null;
};

export type BusinessEligibilityResponse = {
  success: boolean;
  eligible: boolean;
  verified: boolean;
  reason?: string;
  invoiceEnabled?: boolean;
};

export type BusinessBillingConfig = {
  invoiceEnabled?: boolean | number | string;
  hasActiveFund?: boolean | number | string;
  billingAnchorDay?: number | null;
  currentCycle?: { periodStart?: string | null; periodEnd?: string | null } | null;
  openAmount?: number | null;
  nextInvoiceDate?: string | null;
};

export type BusinessBillingResponse = {
  success: boolean;
  config: BusinessBillingConfig | null;
};

export class BusinessResource extends ResourceClient {
  eligibility() {
    return this.get<BusinessEligibilityResponse>("/api/business/eligibility");
  }

  verification() {
    return this.get<BusinessVerificationResponse>("/api/business/verification");
  }

  fund() {
    return this.get<BusinessFundStatusResponse>("/api/business/fund");
  }

  requestFund(amount: number, bindingMonths: number) {
    return this.post<{ success: boolean; contractId?: string; error?: string }>("/api/business/fund", {
      amount,
      bindingMonths,
    });
  }

  /** `offerId` is the pending offer id. `guthaben` pays the first amount from balance. */
  acceptFund(offerId: string, paymentMethod: "mollie" | "guthaben" = "mollie") {
    return this.post<{ success: boolean; checkoutUrl?: string | null }>(
      `/api/business/fund/${encodeURIComponent(offerId)}/accept`,
      { paymentMethod },
    );
  }

  cancelFund(contractId: string) {
    return this.post<{ success: boolean }>(`/api/business/fund/${encodeURIComponent(contractId)}/cancel`, {});
  }

  billing() {
    return this.get<BusinessBillingResponse>("/api/business/billing");
  }

  submitVerification(formData: FormData) {
    return this.post<{ success: boolean }>("/api/business/verification", formData);
  }
}
