export type BillingPeriodOptions = {
  billingDiscountPerMonth?: number;
  billingSurcharge7d?: number;
  billingSurcharge14d?: number;
};

function normalizeSurchargePercent(value: number | undefined, max = 100): number {
  if (value == null) return 0;
  const v = Number(value);
  if (Number.isNaN(v)) return 0;
  if (v <= 2) return Math.min(max, v * 10);
  return Math.max(0, Math.min(max, v));
}

export function computePeriodPrice(
  priceMonthly: number,
  billingCycleDays: number,
  options: BillingPeriodOptions = {},
): number {
  const discountPerMonth = Math.max(0, Math.min(5, options.billingDiscountPerMonth ?? 0));
  const surcharge7Pct = normalizeSurchargePercent(options.billingSurcharge7d);
  const surcharge14Pct = normalizeSurchargePercent(options.billingSurcharge14d);

  if (billingCycleDays <= 7) {
    const base = (priceMonthly * 7) / 30;
    return base * (1 + surcharge7Pct / 100);
  }
  if (billingCycleDays <= 14) {
    const base = (priceMonthly * 14) / 30;
    return base * (1 + surcharge14Pct / 100);
  }

  const months = billingCycleDays >= 365 ? 12 : billingCycleDays / 30;
  const discountPct = Math.min(100, discountPerMonth * Math.max(0, months - 1));
  return priceMonthly * months * (1 - discountPct / 100);
}
