import { ResourceClient } from "./resource-client";

export type CheckoutAddress = {
  id: string;
  label?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  street: string;
  zip: string;
  city: string;
  countryCode: string;
  country: string;
  phone?: string | null;
  vatId?: string | null;
  isDefault?: boolean;
};

export type CheckoutCountry = {
  countryCode: string;
  countryName: string;
  taxRate?: number;
  taxName?: string;
  isDefault?: boolean;
};

export type CheckoutBootstrap = {
  success: boolean;
  addresses: CheckoutAddress[];
  countries: CheckoutCountry[];
  netPointsBalance: { points: number; eurValue: number } | null;
  businessBillingConfig: {
    invoiceEnabled: boolean;
    hasActiveFund: boolean;
    anchorDay: number | null;
  } | null;
  familyBillingConfig: {
    groupId: string;
    walletBalance: number;
    billingMode?: string;
    billingPriority?: string;
    requirePaymentApproval?: boolean;
    sharedBalance?: boolean;
    userRole?: string;
    userBillingMode?: string;
    accountLocked?: boolean;
  } | null;
  savedPaymentMethods: {
    hasValid: boolean;
    defaultLabel: string | null;
    defaultMandateId: string | null;
  } | null;
};

/** Positions-Payload für validate/calculate/submit. */
export type CheckoutCartLine = {
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  billingCycle: number;
  itemType: "new" | "renewal" | "upgrade";
  serviceId?: string;
  subscriptionId?: string;
  daysExtension?: number;
  billingMode?: "PREPAID" | "CONTRACT";
  contractTermMonths?: number;
  customization?: { vcores?: number; memory?: number; storage?: number };
  locationId?: string;
};

export type CartValidateResponse = {
  success: boolean;
  unavailable?: Array<{ lineId: string; productName: string }>;
};

export type CalculatePayload = {
  items: Array<Record<string, unknown>>;
  countryCode?: string;
  hasVatId?: boolean;
  vatNumber?: string;
  lang?: string;
};

export type CartCalculateResponse = {
  success: boolean;
  items?: Array<{ productId: string; productName: string; total: number; quantity?: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  firstMonthAmount?: number;
  taxName?: string;
  taxRatePercent?: number;
  isVatFree?: boolean;
};

export type CheckoutPaymentMethod =
  | "mollie"
  | "mollie_saved"
  | "sepa"
  | "guthaben"
  | "invoice"
  | "businessfund"
  | "family_wallet";

export type CheckoutSubmitPayload = {
  items: Array<Record<string, unknown>>;
  paymentMethod: CheckoutPaymentMethod;
  savedMandateId?: string;
  couponCode?: string;
  affiliateCode?: string;
  netPointsRedeemEur?: number;
  billingAddressId?: string;
  billingAddress?: {
    label?: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    street: string;
    zip: string;
    city: string;
    countryCode: string;
    country: string;
    phone?: string;
    vatId?: string;
    isDefault?: boolean;
  };
  newsletterOptIn?: boolean;
  offerToken?: string;
  lang?: string;
};

export type CheckoutSubmitResponse = {
  success: boolean;
  subscriptionIds?: string[];
  invoiceId?: string;
  redirectUrl?: string;
  processing?: boolean;
  orderId?: string;
  sepaDetails?: {
    iban: string;
    bic: string;
    bankName?: string;
    amount: number;
    reference: string;
  };
};

export class CheckoutResource extends ResourceClient {
  bootstrap() {
    return this.get<CheckoutBootstrap>("/api/checkout/bootstrap");
  }

  countries() {
    return this.get<{ success: boolean; countries: CheckoutCountry[] }>(
      "/api/public/countries",
    );
  }

  validate(items: Array<Record<string, unknown>>) {
    return this.post<CartValidateResponse>("/api/cart/validate", { items });
  }

  calculate(payload: CalculatePayload) {
    return this.post<CartCalculateResponse>("/api/cart/calculate", payload);
  }

  submit(payload: CheckoutSubmitPayload) {
    return this.post<CheckoutSubmitResponse>("/api/checkout", payload);
  }
}
