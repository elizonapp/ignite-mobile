export type PaymentMailLog = {
  id: string;
  templateSlug: string;
  createdAt: string;
  hasDunningDocument?: boolean;
  documentRefs?: Array<{ type: "invoice" | "dunning"; href: string }>;
};

export type InvoiceSepaDetails = {
  iban: string;
  bic: string;
  bankName?: string;
  amount: number;
  reference: string;
};

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
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  isCreditNote?: boolean;
  serviceIds?: string[];
  canDispute?: boolean;
  hasDunningDocument?: boolean;
  claimHandedToCollection?: boolean;
  claimSuspended?: boolean;
  claimSuspendedReason?: string | null;
  claimSuspendedUserNote?: string | null;
  disputeTicketId?: string | null;
  netPointsRedeemed?: number;
};

export type InvoiceDetailItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serviceId?: string;
  itemType?: string;
  serviceType?: "vm" | "storage";
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  number?: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  taxName?: string | null;
  taxRate?: number | null;
  taxRatePercent?: number | null;
  taxType?: string | null;
  taxTypeNote?: string | null;
  total: number;
  currency: string;
  dueAt?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  pdfUrl?: string | null;
  hasLexwareDocument?: boolean;
  hasPendingMolliePayment?: boolean;
  hasDunningDocument?: boolean;
  dunningCreatedAt?: string | null;
  dunningDocumentUrl?: string | null;
  canDispute?: boolean;
  disputeDeadlineAt?: string | null;
  disputeTicketId?: string | null;
  disputeTicketNumber?: string | null;
  claimHandedToCollection?: boolean;
  claimSuspended?: boolean;
  claimSuspendedReason?: string | null;
  claimSuspendedUserNote?: string | null;
  claimHandedOverAt?: string | null;
  paymentMailLogs?: PaymentMailLog[];
  lexwareCreditNoteId?: string | null;
  lexwareCreditNoteVoucherId?: string | null;
  creditNoteDocumentUrl?: string | null;
  creditNoteForInvoiceNumber?: string | null;
  netPointsRedeemed?: number;
  netPointsRedeemedAmount?: number;
  netPointsEarned?: number;
  sepaDetails?: InvoiceSepaDetails;
  serviceIds?: string[];
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

export type WalletPromoEvent = {
  name: string;
  percentExtra: number;
  applyAt: string;
};
