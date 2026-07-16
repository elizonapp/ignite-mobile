import { ResourceClient } from "./resource-client";
import type {
  ActionDispatchResponse,
  RawProviderViewResponse,
} from "../components/provider/types";

export type SubscriptionBillingCouponKind = "none" | "firstInvoiceOnly" | "infinite" | "finite";

export type SubscriptionBillingPreview = {
  billedCycleDays: number;
  regularRenewalGross: number;
  nextRenewalGross: number;
  couponKind: SubscriptionBillingCouponKind;
  couponAppliesToNextRenewal: boolean;
  couponCode: string | null;
  couponRecurringMonths: number | null;
  approxLastDiscountedBoundary: string | null;
  effectiveMonthsElapsedAtNextRenewal: number;
  orderCouponCodeSnapshot?: string | null;
  orderCouponDiscountAmount?: number | null;
  adminScheduledAppliesToNextRenewal: boolean;
  adminScheduledPercent: number | null;
};

export type ServiceSubscriptionSummary = {
  id: string;
  billingCycleDays: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  status: string;
  canceledAt: string | null;
  nextBillingCycleDays: number | null;
  permanentDiscountPercent?: number | null;
  billingMode?: string;
  bindingEndsAt?: string | null;
  earlyTerminationFeePercent?: number | null;
  contractNoticeDays?: number | null;
  options?: {
    autoBillingEnabled?: boolean;
    useNetPointsFirst?: boolean;
  };
  extendEligibility?: {
    bonusAvailable: boolean;
    loyaltyOfferAvailable?: boolean;
    cooldownUntil?: string;
  };
  cancellation?: {
    source: "admin" | "customer" | "system";
    reason: string;
    locked: boolean;
    scheduledAt: string;
  } | null;
  billingPreview?: SubscriptionBillingPreview | null;
};

export type ServiceContractDocuments = {
  billingMode: string;
  productName?: string;
  conditions: {
    billingCycleDays: number;
    contractTermMonths: number | null;
    contractDiscountPercent: number | null;
    bindingEndsAt: string | null;
    earlyTerminationFeePercent: number | null;
    contractNoticeDays: number | null;
    startedAt: string;
  };
  legalDocuments: Array<{ filename: string; downloadUrl: string }>;
  dpa?: {
    hasActiveAgreement: boolean;
    documents: Array<{ id: string; fileName: string; status: string; downloadUrl: string; createdAt: string }>;
  } | null;
};

export class ServicesResource extends ResourceClient {
  find(id: string) {
    return this.get<{ success: boolean; server?: unknown }>(`/api/services/${id}`);
  }

  list(limit = 50, view?: string) {
    return this.get<{ success: boolean; servers?: unknown[]; services?: unknown[]; pagination?: { total: number } }>(
      "/api/services",
      { limit, view },
    );
  }

  /** GET /api/services/:id/view — serialized provider ViewModel (tabs, widgets, actions, fields). */
  view(id: string) {
    return this.get<RawProviderViewResponse>(`/api/services/${encodeURIComponent(id)}/view`);
  }

  /** POST /api/services/:id/actions/:key — dispatch a schema action (start/stop/restart/…). */
  action(id: string, key: string, body?: Record<string, unknown>) {
    return this.post<ActionDispatchResponse>(
      `/api/services/${encodeURIComponent(id)}/actions/${encodeURIComponent(key)}`,
      body ?? {},
    );
  }

  statusBatch(ids: string[]) {
    return this.post<{ success: boolean; statuses: Record<string, Record<string, unknown>> }>(
      "/api/services/status-batch",
      { ids },
    );
  }

  /** GET /api/services/:id/subscription */
  subscriptionGet(id: string) {
    return this.get<{ success: boolean; subscription?: ServiceSubscriptionSummary }>(
      `/api/services/${encodeURIComponent(id)}/subscription`,
    );
  }

  /** POST /api/services/:id/subscription/cancel */
  subscriptionCancel(
    id: string,
    immediate = false,
    body?: { mode?: string; reason?: string },
  ) {
    return this.post<{
      success: boolean;
      message?: string;
      currentPeriodEnd?: string;
      invoiceId?: string | null;
    }>(
      `/api/services/${encodeURIComponent(id)}/subscription/cancel`,
      { immediate, ...body },
    );
  }

  /** POST /api/services/:id/subscription/reactivate */
  subscriptionReactivate(id: string) {
    return this.post<{ success: boolean; message?: string; currentPeriodEnd?: string }>(
      `/api/services/${encodeURIComponent(id)}/subscription/reactivate`,
      {},
    );
  }

  /** PATCH /api/services/:id/subscription/autopay */
  subscriptionAutopay(id: string, body: { autoBillingEnabled: boolean; useNetPointsFirst: boolean }) {
    return this.patch<{ success: boolean; subscription?: { id: string; options?: unknown } }>(
      `/api/services/${encodeURIComponent(id)}/subscription/autopay`,
      body,
    );
  }

  /** PATCH /api/services/:id/subscription/interval */
  subscriptionInterval(id: string, billingCycleDays: number) {
    return this.patch<{ success: boolean; nextBillingCycleDays?: number; currentPeriodEnd?: string }>(
      `/api/services/${encodeURIComponent(id)}/subscription/interval`,
      { billingCycleDays },
    );
  }

  /** POST /api/services/:id/subscription/extend */
  subscriptionExtend(
    id: string,
    body?: { withBonus?: boolean; withLoyaltyOffer?: boolean; extensionDays?: number },
  ) {
    return this.post<{ success: boolean; invoiceId?: string | null; extensionDays?: number; newPeriodEnd?: string }>(
      `/api/services/${encodeURIComponent(id)}/subscription/extend`,
      body ?? {},
    );
  }

  /** POST /api/services/:id/renew — renewal price preview */
  renewPreview(id: string, billingCycleDays: number) {
    return this.post<{
      success: boolean;
      price?: number;
      currentPeriodEnd?: string;
      newPeriodEnd?: string;
      maxDate?: string;
      subscriptionId?: string;
      promotionSavingsMonthlyApprox?: number;
    }>(`/api/services/${encodeURIComponent(id)}/renew`, { billingCycleDays });
  }

  /** GET /api/services/:id/contract-documents */
  contractDocuments(id: string) {
    return this.get<{ success: boolean } & Partial<ServiceContractDocuments>>(
      `/api/services/${encodeURIComponent(id)}/contract-documents`,
    );
  }

  /** GET /api/services/:id/billing-cycles */
  billingCycles(id: string) {
    return this.get<{ success: boolean; allowedBillingCycles?: number[] }>(
      `/api/services/${encodeURIComponent(id)}/billing-cycles`,
    );
  }
}
