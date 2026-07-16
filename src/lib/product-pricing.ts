import { computePeriodPrice, type BillingPeriodOptions } from "./billing";
import { calculateMailcowSurcharge, type MailcowLimits } from "./mailcow-pricing";
import { calculateTrafficAddonPrice, type TrafficPricingBlock } from "./traffic-pricing";
import { numSpec, type ProductProviderOptions, type ShopProductDetail, type ShopUpgradeConfig } from "./shop-product-detail";

export function productUsesMbResources(product: ShopProductDetail): boolean {
  return (
    product.provider?.type?.toUpperCase() === "PTERODACTYL" ||
    (product.pterodactylEggs?.length ?? 0) > 0 ||
    product.providerCapabilities?.usesMbResources === true
  );
}

export function initialProductProviderOptions(product: ShopProductDetail): ProductProviderOptions {
  return {
    vcores: numSpec(product.vcores, 2),
    memory: numSpec(product.memory, 4),
    storage: numSpec(product.storage, 50),
    selectedLocationId: "",
    selectedTemplateId: undefined,
    additionalIPv4: 0,
    additionalIPv6: 0,
    includeIPv4: true,
    includeIPv6: true,
    sshKeyIds: [],
    trafficAddonTb: 0,
    speedUpgradeGbit: 0,
    maxDomains: typeof product.maxDomains === "number" ? product.maxDomains : undefined,
    maxMailboxesPerDomain:
      typeof product.maxMailboxesPerDomain === "number" ? product.maxMailboxesPerDomain : undefined,
    storagePerMailboxGb:
      typeof product.storagePerMailboxGb === "number" ? product.storagePerMailboxGb : undefined,
    maxAliasesPerDomain:
      typeof product.maxAliasesPerDomain === "number" ? product.maxAliasesPerDomain : undefined,
    eggId: product.pterodactylProductEggId ?? product.pterodactylEggs?.[0]?.eggId,
    nestId: product.pterodactylProductNestId ?? product.pterodactylEggs?.[0]?.nestId,
    dockerImage:
      product.pterodactylEggs?.[0]?.defaultDockerImage ||
      product.pterodactylEggs?.[0]?.dockerImages?.[0],
    environment: {},
    providerVariables: {},
  };
}

export function computeBasePriceMonthly(
  product: ShopProductDetail,
  options: ProductProviderOptions,
  upgradeConfig: ShopUpgradeConfig | null,
  usesMb: boolean,
): number {
  const base = Number(product.priceMonthly) || 0;
  const pricing = upgradeConfig?.resourcePricing;
  const baseVcores = numSpec(product.vcores, 2);
  const baseMemory = numSpec(product.memory, 4);
  const baseStorage = numSpec(product.storage, 50);
  let extra = 0;

  if (pricing) {
    if (pricing.vcores?.upgradePrice && options.vcores > baseVcores) {
      extra += (options.vcores - baseVcores) * pricing.vcores.upgradePrice;
    }
    if (pricing.memory?.upgradePrice && options.memory > baseMemory) {
      const memDiff = usesMb ? (options.memory - baseMemory) / 1024 : options.memory - baseMemory;
      extra += memDiff * pricing.memory.upgradePrice;
    }
    if (pricing.storage?.upgradePrice && options.storage > baseStorage) {
      const storageStep = pricing.storage.step ?? 10;
      const storageDiff = usesMb ? (options.storage - baseStorage) / 1024 : options.storage - baseStorage;
      extra += (storageDiff / storageStep) * pricing.storage.upgradePrice;
    }

    const baseMailcow: MailcowLimits = {
      maxDomains: typeof product.maxDomains === "number" ? product.maxDomains : 1,
      maxMailboxesPerDomain: typeof product.maxMailboxesPerDomain === "number" ? product.maxMailboxesPerDomain : 5,
      storagePerMailboxGb: typeof product.storagePerMailboxGb === "number" ? product.storagePerMailboxGb : 1,
      maxAliasesPerDomain: typeof product.maxAliasesPerDomain === "number" ? product.maxAliasesPerDomain : 5,
    };
    extra += calculateMailcowSurcharge(baseMailcow, {
      maxDomains: options.maxDomains ?? baseMailcow.maxDomains,
      maxMailboxesPerDomain: options.maxMailboxesPerDomain ?? baseMailcow.maxMailboxesPerDomain,
      storagePerMailboxGb: options.storagePerMailboxGb ?? baseMailcow.storagePerMailboxGb,
      maxAliasesPerDomain: options.maxAliasesPerDomain ?? baseMailcow.maxAliasesPerDomain,
    }, pricing);
  }

  if (product.provider?.type?.toUpperCase() === "PROXMOX" && (options.trafficAddonTb ?? 0) > 0) {
    extra += calculateTrafficAddonPrice(options.trafficAddonTb ?? 0, product.trafficPricingBlocks as TrafficPricingBlock[] | undefined);
  }

  if ((options.speedUpgradeGbit ?? 0) > 0 && Array.isArray(product.speedUpgradeOptions)) {
    const selected = product.speedUpgradeOptions.find((row) => row.gbit === options.speedUpgradeGbit);
    if (selected) extra += selected.priceGross;
  }

  return base + extra;
}

export function computeIpPriceMonthly(
  product: ShopProductDetail,
  options: ProductProviderOptions,
  upgradeConfig: ShopUpgradeConfig | null,
  ipv6Pricing: Record<string, number> | null,
): number {
  const ipv4Price = upgradeConfig?.additionalIpsPricePerMonth ?? 0;
  let subnetSize = 64;
  if (product.providerCapabilities?.defaultIPv6Cidr) {
    subnetSize = Number(product.providerCapabilities.defaultIPv6Cidr) || 64;
  }
  let ipv6UnitPrice = 0;
  if (ipv6Pricing && typeof ipv6Pricing === "object") {
    ipv6UnitPrice = ipv6Pricing[String(subnetSize)] ?? 0;
  }
  let ipv6Price = 0;
  if (options.additionalIPv6 > 0) {
    ipv6Price = ipv6UnitPrice * options.additionalIPv6;
  }
  return ipv4Price * options.additionalIPv4 + ipv6Price;
}

export function computeIpv4OptOutDiscount(
  product: ShopProductDetail,
  options: ProductProviderOptions,
  upgradeConfig: ShopUpgradeConfig | null,
): number {
  if (options.includeIPv4) return 0;
  const supportsIpDnsRecords =
    product.providerCapabilities?.supportsIpDnsRecords === true ||
    Number(product.providerCapabilities?.maxIPv4 ?? 0) > 0;
  if (!supportsIpDnsRecords) return 0;
  return upgradeConfig?.ipv4OptOutDiscount ?? 0;
}

export function computeProductPriceMonthly(
  product: ShopProductDetail,
  options: ProductProviderOptions,
  upgradeConfig: ShopUpgradeConfig | null,
  ipv6Pricing: Record<string, number> | null,
): number {
  const usesMb = productUsesMbResources(product);
  const basePriceMonthly = computeBasePriceMonthly(product, options, upgradeConfig, usesMb);
  const ipPriceMonthly = computeIpPriceMonthly(product, options, upgradeConfig, ipv6Pricing);
  const ipv4OptOutDiscount = computeIpv4OptOutDiscount(product, options, upgradeConfig);
  return Math.max(0, basePriceMonthly + ipPriceMonthly - ipv4OptOutDiscount);
}

export function getBillingOptions(product: ShopProductDetail): BillingPeriodOptions {
  return {
    billingDiscountPerMonth: product.billingDiscountPerMonth ?? 0,
    billingSurcharge7d: product.billingSurcharge7d ?? 0,
    billingSurcharge14d: product.billingSurcharge14d ?? 0,
  };
}

export function computeProductPeriodPrice(
  priceMonthly: number,
  billingCycle: number,
  billingOptions: BillingPeriodOptions,
): number {
  return Math.max(0, computePeriodPrice(priceMonthly, billingCycle, billingOptions));
}

export function computeContractMonthlyPrice(
  priceMonthly: number,
  contractDiscountPercent: number,
): number {
  const discount = Math.max(0, Math.min(100, contractDiscountPercent));
  return Math.round(priceMonthly * (1 - discount / 100) * 100) / 100;
}

export function computeContractPeriodPrice(
  priceMonthly: number,
  contractDiscountPercent: number,
  billingCycleDays: number,
  billingOptions?: BillingPeriodOptions,
): number {
  const monthly = computeContractMonthlyPrice(priceMonthly, contractDiscountPercent);
  return Math.max(0, computePeriodPrice(monthly, billingCycleDays, billingOptions));
}

export function filterContractBillingIntervals(product: ShopProductDetail): number[] {
  const intervals = (product.contractBillingIntervals ?? [30]).filter((d) =>
    [30, 90, 180].includes(d),
  );
  return intervals.length > 0 ? [...intervals].sort((a, b) => a - b) : [30];
}

export function defaultContractBillingInterval(product: ShopProductDetail): number {
  const intervals = filterContractBillingIntervals(product);
  return intervals.includes(30) ? 30 : intervals[0] ?? 30;
}

export function filterAllowedBillingCycles(product: ShopProductDetail): number[] {
  const cycles = (product.allowedBillingCycles ?? [30]).filter((d) =>
    [7, 14, 30, 60, 90, 120, 180, 365].includes(d),
  );
  return cycles.length > 0 ? [...cycles].sort((a, b) => a - b) : [30];
}

export function defaultBillingCycle(product: ShopProductDetail): number {
  const cycles = filterAllowedBillingCycles(product);
  return cycles.includes(30) ? 30 : cycles[0] ?? 30;
}

export type ProductPriceBreakdown = {
  basePriceMonthly: number;
  ipPriceMonthly: number;
  ipv4OptOutDiscount: number;
  priceMonthly: number;
  periodPrice: number;
  equivalentMonthlyPrice: number;
  usesMbResources: boolean;
};

export function computeProductPriceBreakdown(args: {
  product: ShopProductDetail;
  options: ProductProviderOptions;
  upgradeConfig: ShopUpgradeConfig | null;
  ipv6Pricing: Record<string, number> | null;
  billingCycle: number;
  billingMode?: "PREPAID" | "CONTRACT";
  contractDiscountPercent?: number;
}): ProductPriceBreakdown {
  const { product, options, upgradeConfig, ipv6Pricing, billingCycle, billingMode, contractDiscountPercent } = args;
  const usesMb = productUsesMbResources(product);
  const basePriceMonthly = computeBasePriceMonthly(product, options, upgradeConfig, usesMb);
  const ipPriceMonthly = computeIpPriceMonthly(product, options, upgradeConfig, ipv6Pricing);
  const ipv4OptOutDiscount = computeIpv4OptOutDiscount(product, options, upgradeConfig);
  const priceMonthly = Math.max(0, basePriceMonthly + ipPriceMonthly - ipv4OptOutDiscount);
  const billingOptions = getBillingOptions(product);

  const isContract = billingMode === "CONTRACT" && contractDiscountPercent != null;
  const periodPrice = isContract
    ? Math.max(
        0,
        computeContractPeriodPrice(basePriceMonthly, contractDiscountPercent, billingCycle, billingOptions) +
          computeContractPeriodPrice(ipPriceMonthly, contractDiscountPercent, billingCycle, billingOptions) -
          computeContractPeriodPrice(ipv4OptOutDiscount, contractDiscountPercent, billingCycle, billingOptions),
      )
    : Math.max(
        0,
        computePeriodPrice(basePriceMonthly, billingCycle, billingOptions) +
          computePeriodPrice(ipPriceMonthly, billingCycle, billingOptions) -
          computePeriodPrice(ipv4OptOutDiscount, billingCycle, billingOptions),
      );
  const equivalentMonthlyPrice = billingCycle > 0 ? (periodPrice / billingCycle) * 30 : periodPrice;

  return {
    basePriceMonthly,
    ipPriceMonthly,
    ipv4OptOutDiscount,
    priceMonthly,
    periodPrice,
    equivalentMonthlyPrice,
    usesMbResources: usesMb,
  };
}
