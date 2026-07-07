export type ShopProviderInfo = {
  id: string;
  type: string;
  name: string;
} | null;

export type ShopProductDetail = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  categoryId?: string;
  soldOut?: boolean;
  priceMonthly: string | number;
  priceYearly?: number | null;
  setupFee?: number;
  vcores: string | number;
  memory: string | number;
  storage: string | number;
  networkLimitMBs?: number | null;
  allowCpuCustomization?: boolean;
  allowRamCustomization?: boolean;
  allowStorageCustomization?: boolean;
  allowedBillingCycles?: number[];
  billingDiscountPerMonth?: number;
  billingSurcharge7d?: number;
  billingSurcharge14d?: number;
  provider?: ShopProviderInfo;
};

export type ShopUpgradeConfig = {
  allowPrePurchaseUpgrade?: boolean;
  resourcePricing?: Record<
    string,
    {
      upgradePrice?: number;
      allowDowngrade?: boolean;
      max?: number;
      step?: number;
    }
  >;
};

export type ShopLocationOption = {
  id: string;
  name: string;
  city?: string;
  country?: string;
};

export type ConfiguratorProviderOptions = {
  vcores: number;
  memory: number;
  storage: number;
  minNetworkMBs: number;
  selectedLocationId?: string;
  billingCycle: number;
};

export function usesMbResources(providerType?: string | null): boolean {
  return providerType?.toUpperCase() === "PROXMOX";
}

export function numSpec(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
