import { ResourceClient } from "./resource-client";

export type AutoTopupConfig = {
  id: string;
  isActive: boolean;
  amount: number;
  dayOfMonth: number;
  lastChargedAt?: string | null;
  nextChargeAt?: string | null;
  mandateVerifiedAt?: string | null;
  autoRedeemVoucher?: boolean;
  createdAt?: string | null;
};

export type AutoTopupCreateBody = {
  amount: number;
  dayOfMonth: number;
  autoRedeemVoucher?: boolean;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptExpiry?: boolean;
};

export type WalletVoucher = {
  id: string;
  paidAmount: number;
  faceValue: number;
  redeemCreditAmount: number;
  status: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  redeemedAt?: string | null;
  source?: string | null;
  promoPercent?: number | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  canWithdraw?: boolean;
  withdrawUntil?: string | null;
};

export type WalletBonusEvent = {
  name: string;
  percentExtra: number;
  applyAt: string;
};

export class WalletResource extends ResourceClient {
  bonusEvent() {
    return this.get<{ success: boolean; event: WalletBonusEvent | null }>("/api/wallet/bonus-event");
  }

  autoTopupList() {
    return this.get<{ success: boolean; configs: AutoTopupConfig[] }>("/api/balance/auto-topup");
  }

  autoTopupCreate(body: AutoTopupCreateBody) {
    return this.post<{
      success: boolean;
      config?: AutoTopupConfig;
      verificationCheckoutUrl?: string;
      verificationRequired?: boolean;
      deferredFirstCharge?: boolean;
      firstChargeOn?: string;
    }>("/api/balance/auto-topup", body);
  }

  autoTopupUpdate(id: string, body: { isActive?: boolean; amount?: number }) {
    return this.patch<{ success: boolean; config?: AutoTopupConfig }>(
      `/api/balance/auto-topup/${encodeURIComponent(id)}`,
      body,
    );
  }

  autoTopupDelete(id: string) {
    return this.delete<{ success: boolean }>(`/api/balance/auto-topup/${encodeURIComponent(id)}`);
  }

  vouchers(limit = 10, offset = 0) {
    return this.get<{ success: boolean; vouchers: WalletVoucher[]; total: number }>("/api/wallet/vouchers", {
      limit,
      offset,
    });
  }

  redeemVoucher(code: string) {
    return this.post<{
      success: boolean;
      creditAmount?: number;
      newBalance?: number;
      voucherId?: string;
    }>("/api/wallet/vouchers/redeem", { code });
  }

  voucherCode(id: string) {
    return this.get<{ success: boolean; code?: string }>(
      `/api/wallet/vouchers/${encodeURIComponent(id)}/code`,
    );
  }

  withdrawVoucher(id: string) {
    return this.post<{
      success: boolean;
      refundedAmount?: number;
      mollieRefundId?: string;
    }>(`/api/wallet/vouchers/${encodeURIComponent(id)}/withdraw`);
  }
}
