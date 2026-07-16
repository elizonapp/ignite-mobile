import { ResourceClient } from "./resource-client";
import type { QueryParams } from "./types";

export type InvoiceListFilters = {
  status?: string;
  serviceId?: string;
  limit?: number;
  offset?: number;
};

export type InvoicePayBody = {
  paymentMethod: "mollie" | "mollie_saved" | "guthaben";
  savedMandateId?: string;
  amountFromBalance?: number;
  netPointsRedeemEur?: number;
};

export type InvoicePayResult = {
  success: boolean;
  alreadyPaid?: boolean;
  paymentId?: string;
  checkoutUrl?: string;
  processing?: boolean;
};

export type SavedPaymentMethod = {
  mandateId: string;
  label?: string | null;
  userLabel?: string | null;
  method?: string | null;
  brand?: string | null;
  last4?: string | null;
  isDefault?: boolean;
  createdAt?: string | null;
};

export type PaymentMethodsResult = {
  success: boolean;
  canManage: boolean;
  methods: SavedPaymentMethod[];
  defaultMandateId: string | null;
  maxMethods: number;
  canAddMore: boolean;
};

export class BillingResource extends ResourceClient {
  invoices(limitOrFilters: number | InvoiceListFilters = 50) {
    const query: QueryParams =
      typeof limitOrFilters === "number"
        ? { limit: limitOrFilters }
        : {
            limit: limitOrFilters.limit ?? 50,
            offset: limitOrFilters.offset,
            status: limitOrFilters.status,
            serviceId: limitOrFilters.serviceId,
          };
    return this.get<{ success: boolean; invoices: unknown[]; pagination?: { total: number; hasMore?: boolean } }>(
      "/api/invoices",
      query,
    );
  }

  invoice(id: string) {
    return this.get<{ success: boolean; invoice: unknown }>(`/api/invoices/${id}`);
  }

  payInvoice(id: string, body: InvoicePayBody) {
    return this.post<InvoicePayResult>(`/api/invoices/${id}/pay`, body);
  }

  netPointsPreview(orderTotal: number) {
    return this.post<{ success: boolean; maxEur: number; maxPoints: number; currentBalance: number }>(
      "/api/netpoints/preview",
      { orderTotal },
    );
  }

  subscriptions() {
    return this.get<{ success: boolean; subscriptions: unknown[] }>("/api/user/subscriptions");
  }

  paymentMethods() {
    return this.get<PaymentMethodsResult>("/api/account/payment-methods");
  }

  addPaymentMethod() {
    return this.post<{ success: boolean; checkoutUrl?: string }>("/api/account/payment-methods");
  }

  setDefaultPaymentMethod(mandateId: string) {
    return this.patch<{ success: boolean }>("/api/account/payment-methods", { mandateId });
  }

  updatePaymentMethodLabel(mandateId: string, userLabel: string, setDefault = false) {
    return this.patch<{ success: boolean }>("/api/account/payment-methods", {
      mandateId,
      userLabel,
      setDefault,
    });
  }

  deletePaymentMethod(mandateId: string) {
    return this.delete<{ success: boolean }>(`/api/account/payment-methods/${encodeURIComponent(mandateId)}`);
  }

  disputeInvoice(id: string, reason: string) {
    return this.post<{ success: boolean; ticketId?: string; ticketNumber?: string }>(
      `/api/invoices/${encodeURIComponent(id)}/dispute`,
      { reason },
    );
  }
}
