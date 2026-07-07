export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  number?: string;
  displayVoucherNumber?: string | null;
  status: string;
  amount: number;
  total: number;
  currency: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  isCreditNote?: boolean;
  serviceIds?: string[];
};

export type InvoiceDetailItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serviceId?: string;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  number?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  taxName?: string | null;
  taxRatePercent?: number | null;
  total: number;
  currency: string;
  dueAt?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  pdfUrl?: string | null;
  hasPendingMolliePayment?: boolean;
  netPointsRedeemed?: number;
  netPointsRedeemedAmount?: number;
  items: InvoiceDetailItem[];
};

export type Subscription = {
  id: string;
  status: string;
  billingCycleDays: number;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  permanentDiscountPercent?: number | null;
  product?: { id: string; name: string; priceMonthly?: number | null } | null;
  service?: { id: string; name: string; providerStatus?: string | null } | null;
};
