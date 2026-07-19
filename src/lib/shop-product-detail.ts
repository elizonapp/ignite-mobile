export type ShopProviderInfo = {
  id: string;
  type: string;
  name: string;
} | null;

export type ShopEggVariable = {
  envVariable: string;
  name?: string;
  description?: string;
  defaultValue?: string;
  userViewable?: boolean;
  userEditable?: boolean;
  rules?: string;
};

export type ShopProviderVariableSpec = {
  name: string;
  labels?: Record<string, string>;
  type: "text" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholderKey?: string;
};

export type ShopPterodactylEgg = {
  eggId: number;
  nestId?: number;
  name?: string;
  displayName?: string;
  description?: string;
  variables?: ShopEggVariable[];
  dockerImages?: string[];
  defaultDockerImage?: string;
  providerVariables?: ShopProviderVariableSpec[];
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
  storagePerDomainGb?: number;
  dnsManagement?: number;
  /** Ploi entitlements */
  storageGb?: number;
  databases?: number;
  domains?: number;
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
  billingModeAvailability?: string;
  contractTerms?: Array<{ termMonths: number; discountPercent: number }>;
  contractBillingIntervals?: number[];
  earlyTerminationFeePercent?: number;
  contractNoticeDays?: number;
  contractEligibility?: { eligible: boolean; reason?: string };
  customerAnticipating?: {
    shortCycleSurchargeHint?: string;
    upsellLongerCycleHint?: string;
    savingsHint?: string;
  } | null;
  locationCount?: number;
};

export type ShopUpgradeConfig = {
  upgradeMode?: "disabled" | "packagesOnly" | "freeWithinLimits";
  allowPrePurchaseUpgrade?: boolean;
  configuratorEnabled?: boolean;
  resourcePricing?: Record<
    string,
    {
      upgradePrice?: number;
      allowDowngrade?: boolean;
      max?: number;
      step?: number;
      min?: number;
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
  dockerImage?: string;
  environment?: Record<string, string>;
  providerVariables?: Record<string, string>;
  /** Ploi site hosting */
  domain?: string;
  appType?: string;
  domainMode?: "owned" | "external";
  storageGb?: number;
  databases?: number;
  domains?: number;
  /** Plesk shared hosting */
  storagePerDomainGb?: number;
  dnsManagement?: number;
  pleskLocation?: string;
};

export type ConfiguratorProviderOptions = ProductProviderOptions & {
  minNetworkMBs: number;
  billingCycle: number;
};

export type InvalidUpgradeFields = Partial<
  Record<
    | "vcores"
    | "memory"
    | "storage"
    | "maxDomains"
    | "maxMailboxesPerDomain"
    | "storagePerMailboxGb"
    | "maxAliasesPerDomain"
    | "storagePerDomainGb"
    | "dnsManagement",
    boolean
  >
>;

export function usesMbResources(providerType?: string | null): boolean {
  return providerType?.toUpperCase() === "PTERODACTYL";
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

export function formatDockerImageName(image: string): string {
  const tag = image.split(":").pop() ?? image;
  return tag
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
