export type ShopProviderInfo = {
  id: string;
  type: string;
  name: string;
} | null;

export type ShopPterodactylEgg = {
  eggId: number;
  nestId?: number;
  name?: string;
  displayName?: string;
};

export type ShopProductDetail = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  categoryId?: string;
  category?: string | null;
  chip?: string | null;
  soldOut?: boolean;
  priceMonthly: string | number;
  priceYearly?: number | null;
  setupFee?: number;
  vcores: string | number;
  memory: string | number;
  storage: string | number;
  bandwidth?: string | number;
  bandwidthDisplayUnit?: "TB" | "MBs";
  networkLimitMBs?: number | null;
  trafficTb?: number;
  storageTypeDisplay?: "HDD" | "SSD" | "NVME" | null;
  deployTime?: string;
  sla?: string;
  highlights?: string[];
  maxDomains?: number;
  maxMailboxesPerDomain?: number;
  storagePerMailboxGb?: number;
  maxAliasesPerDomain?: number;
  allowCpuCustomization?: boolean;
  allowRamCustomization?: boolean;
  allowStorageCustomization?: boolean;
  allowedBillingCycles?: number[];
  billingDiscountPerMonth?: number;
  billingSurcharge7d?: number;
  billingSurcharge14d?: number;
  monthlyOffer?: {
    discountPercent: number;
    couponCode: string | null;
    monthKey: string;
    expiresAt: string;
  } | null;
  promotion?: {
    active: boolean;
    kind: string | null;
    discountPercent: number | null;
    campaignEndsAt: string | null;
    savingsMonthlyApprox: number;
    discountedPriceMonthly: number;
    listPriceMonthly: number;
  } | null;
  showLowestPrice30dHint?: boolean;
  lowestPriceMonthly30d?: number | null;
  promotionScarcityRemaining?: number | null;
  catalogAvailabilityRemaining?: number | null;
  provider?: ShopProviderInfo;
  providerCapabilities?: Record<string, unknown> | null;
  maxTrafficAddonTb?: number;
  speedUpgradeOptions?: Array<{ gbit: number; priceGross: number }>;
  trafficPricingBlocks?: Array<{ upToTb: number | null; pricePerTbGross: number }>;
  pterodactylEggs?: ShopPterodactylEgg[];
  pterodactylProductEggId?: number;
  pterodactylProductNestId?: number;
  pterodactylAllowDockerImageSwitch?: boolean;
  schemaCardFields?: Array<{ key: string; label?: string; value?: string }>;
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
  additionalIpsPricePerMonth?: number;
  additionalIPv6PricePerMonth?: number;
  ipv4OptOutDiscount?: number;
};

export type ShopLocationOption = {
  id: string;
  name: string;
  city?: string;
  country?: string;
};

export type ShopTemplateOption = {
  templateId: number;
  name: string;
  displayName: string;
  cloudInitSupport: boolean;
  cloudInitUsername?: string;
};

export type ProductProviderOptions = {
  vcores: number;
  memory: number;
  storage: number;
  selectedLocationId?: string;
  selectedTemplateId?: number;
  additionalIPv4: number;
  additionalIPv6: number;
  includeIPv4: boolean;
  includeIPv6: boolean;
  sshKeyIds: string[];
  trafficAddonTb: number;
  speedUpgradeGbit: number;
  maxDomains?: number;
  maxMailboxesPerDomain?: number;
  storagePerMailboxGb?: number;
  maxAliasesPerDomain?: number;
  eggId?: number;
  nestId?: number;
};

export type ConfiguratorProviderOptions = ProductProviderOptions & {
  minNetworkMBs: number;
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

export function productChipLabel(chip?: string | null): string | null {
  if (!chip) return null;
  return chip.toLowerCase() === "intel" ? "Intel" : "AMD EPYC";
}
