import { calculateMailcowSurcharge } from "./mailcow-pricing";
import { calculatePleskSurcharge } from "./plesk-pricing";
import { calculateTrafficAddonPrice } from "./traffic-pricing";
import { numSpec, type ShopProductDetail, type ShopUpgradeConfig } from "./shop-product-detail";

export type CostBreakdownRow = {
  label: string;
  amount: number;
  isDiscount?: boolean;
};

export function computeConfiguratorCycleFactor(billingCycle: number): number {
  if (billingCycle <= 7) return 7 / 30;
  if (billingCycle <= 14) return 14 / 30;
  if (billingCycle >= 365) return 12;
  return billingCycle / 30;
}

export function computeConfiguratorCostBreakdown(args: {
  activeProduct: ShopProductDetail;
  options: {
    vcores: number;
    memory: number;
    storage: number;
    speedUpgradeGbit?: number;
    trafficAddonTb?: number;
    additionalIPv4: number;
    additionalIPv6: number;
    includeIPv4: boolean;
    maxDomains?: number;
    maxMailboxesPerDomain?: number;
    storagePerMailboxGb?: number;
    maxAliasesPerDomain?: number;
    storagePerDomainGb?: number;
    dnsManagement?: number;
  };
  upgradeConfig: ShopUpgradeConfig | null;
  usesMb: boolean;
  billingCycle: number;
  billingOptions: {
    billingDiscountPerMonth?: number;
    billingSurcharge7d?: number;
    billingSurcharge14d?: number;
  };
  basePriceMonthly: number;
  ipPriceMonthly: number;
  ipv4OptOutDiscount: number;
  ipv6UnitPrice: number;
  t: (key: never) => string;
}): CostBreakdownRow[] {
  const {
    activeProduct,
    options,
    upgradeConfig,
    usesMb,
    billingCycle,
    billingOptions,
    basePriceMonthly,
    ipPriceMonthly,
    ipv4OptOutDiscount,
    ipv6UnitPrice,
    t,
  } = args;
  const translate = t as (key: string) => string;

  const cycleFactor = computeConfiguratorCycleFactor(billingCycle);
  const items: CostBreakdownRow[] = [];
  const base = Number(activeProduct.priceMonthly) || 0;
  const baseVcores = numSpec(activeProduct.vcores, 2);
  const baseMemory = numSpec(activeProduct.memory, 4);
  const baseStorage = numSpec(activeProduct.storage, 50);

  items.push({
    label: translate("configuratorCostBasePlan").replace("{name}", activeProduct.name),
    amount: base * cycleFactor,
  });

  const pricing = upgradeConfig?.resourcePricing;
  if (pricing) {
    if (pricing.vcores?.upgradePrice && options.vcores > baseVcores) {
      const diff = options.vcores - baseVcores;
      items.push({
        label: translate("configuratorCostCpu").replace("{n}", String(diff)).replace("{unit}", "vCores"),
        amount: diff * pricing.vcores.upgradePrice * cycleFactor,
      });
    }
    if (pricing.memory?.upgradePrice && options.memory > baseMemory) {
      const memDiff = usesMb ? (options.memory - baseMemory) / 1024 : options.memory - baseMemory;
      if (memDiff > 0) {
        items.push({
          label: translate("configuratorCostMemory").replace("{n}", String(memDiff)),
          amount: memDiff * pricing.memory.upgradePrice * cycleFactor,
        });
      }
    }
    if (pricing.storage?.upgradePrice && options.storage > baseStorage) {
      const storageStep = pricing.storage.step ?? 10;
      const storageDiff = usesMb ? (options.storage - baseStorage) / 1024 : options.storage - baseStorage;
      if (storageDiff > 0) {
        items.push({
          label: translate("configuratorCostStorage").replace("{n}", String(storageDiff)),
          amount: (storageDiff / storageStep) * pricing.storage.upgradePrice * cycleFactor,
        });
      }
    }

    if (activeProduct.provider?.type?.toUpperCase() === "PLESK") {
      const plesk = calculatePleskSurcharge(
        {
          maxDomains: typeof activeProduct.maxDomains === "number" ? activeProduct.maxDomains : 1,
          storagePerDomainGb:
            typeof activeProduct.storagePerDomainGb === "number" ? activeProduct.storagePerDomainGb : 5,
          maxMailboxesPerDomain:
            typeof activeProduct.maxMailboxesPerDomain === "number"
              ? activeProduct.maxMailboxesPerDomain
              : -1,
          storagePerMailboxGb:
            typeof activeProduct.storagePerMailboxGb === "number" ? activeProduct.storagePerMailboxGb : -1,
          dnsManagement: typeof activeProduct.dnsManagement === "number" ? activeProduct.dnsManagement : -1,
        },
        {
          maxDomains: options.maxDomains ?? activeProduct.maxDomains ?? 1,
          storagePerDomainGb:
            options.storagePerDomainGb ??
            (typeof activeProduct.storagePerDomainGb === "number" ? activeProduct.storagePerDomainGb : 5),
          maxMailboxesPerDomain:
            options.maxMailboxesPerDomain ?? activeProduct.maxMailboxesPerDomain ?? -1,
          storagePerMailboxGb: options.storagePerMailboxGb ?? activeProduct.storagePerMailboxGb ?? -1,
          dnsManagement:
            options.dnsManagement ??
            Math.max(0, typeof activeProduct.dnsManagement === "number" ? activeProduct.dnsManagement : -1),
        },
        pricing,
      );
      if (plesk > 0) items.push({ label: translate("configuratorCostPlesk"), amount: plesk * cycleFactor });
    } else {
      const mailcow = calculateMailcowSurcharge(
        {
          maxDomains: typeof activeProduct.maxDomains === "number" ? activeProduct.maxDomains : 1,
          maxMailboxesPerDomain:
            typeof activeProduct.maxMailboxesPerDomain === "number"
              ? activeProduct.maxMailboxesPerDomain
              : 5,
          storagePerMailboxGb:
            typeof activeProduct.storagePerMailboxGb === "number" ? activeProduct.storagePerMailboxGb : 1,
          maxAliasesPerDomain:
            typeof activeProduct.maxAliasesPerDomain === "number" ? activeProduct.maxAliasesPerDomain : 5,
        },
        {
          maxDomains: options.maxDomains ?? activeProduct.maxDomains ?? 1,
          maxMailboxesPerDomain:
            options.maxMailboxesPerDomain ?? activeProduct.maxMailboxesPerDomain ?? 5,
          storagePerMailboxGb: options.storagePerMailboxGb ?? activeProduct.storagePerMailboxGb ?? 1,
          maxAliasesPerDomain: options.maxAliasesPerDomain ?? activeProduct.maxAliasesPerDomain ?? 5,
        },
        pricing,
      );
      if (mailcow > 0) items.push({ label: translate("configuratorCostMailcow"), amount: mailcow * cycleFactor });
    }
  }

  if ((options.speedUpgradeGbit ?? 0) > 0 && Array.isArray(activeProduct.speedUpgradeOptions)) {
    const selected = activeProduct.speedUpgradeOptions.find((row) => row.gbit === options.speedUpgradeGbit);
    if (selected && (Number(selected.priceGross) || 0) > 0) {
      items.push({
        label: translate("configuratorCostSpeed").replace("{n}", String(options.speedUpgradeGbit)),
        amount: (Number(selected.priceGross) || 0) * cycleFactor,
      });
    }
  }

  if (activeProduct.provider?.type?.toUpperCase() === "PROXMOX" && (options.trafficAddonTb ?? 0) > 0) {
    const trafficPrice = calculateTrafficAddonPrice(options.trafficAddonTb ?? 0, activeProduct.trafficPricingBlocks);
    if (trafficPrice > 0) {
      items.push({
        label: translate("configuratorCostTraffic").replace("{n}", String(options.trafficAddonTb)),
        amount: trafficPrice * cycleFactor,
      });
    }
  }

  if (options.additionalIPv4 > 0 && upgradeConfig?.additionalIpsPricePerMonth) {
    const v4Total = upgradeConfig.additionalIpsPricePerMonth * options.additionalIPv4;
    if (v4Total > 0) {
      items.push({
        label: translate("configuratorCostIpv4").replace("{n}", String(options.additionalIPv4)),
        amount: v4Total * cycleFactor,
      });
    }
  }

  if (options.additionalIPv6 > 0 && ipv6UnitPrice > 0) {
    items.push({
      label: translate("configuratorCostIpv6").replace("{n}", String(options.additionalIPv6)),
      amount: ipv6UnitPrice * options.additionalIPv6 * cycleFactor,
    });
  }

  if (ipv4OptOutDiscount > 0) {
    items.push({
      label: translate("configuratorCostIpv4OptOut"),
      amount: -ipv4OptOutDiscount * cycleFactor,
      isDiscount: true,
    });
  }

  const priceMonthlyVal = Math.max(0, basePriceMonthly + ipPriceMonthly - ipv4OptOutDiscount);
  const perMonthPct = Math.max(0, Math.min(5, billingOptions.billingDiscountPerMonth ?? 0));
  if (perMonthPct > 0 && billingCycle >= 30) {
    const months = billingCycle >= 365 ? 12 : billingCycle / 30;
    const pct = Math.min(100, perMonthPct * Math.max(0, months - 1));
    if (pct > 0) {
      const pctLabel = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
      items.push({
        label: translate("configuratorCostBillingDiscount").replace("{percent}", pctLabel),
        amount: -(priceMonthlyVal * cycleFactor * (pct / 100)),
        isDiscount: true,
      });
    }
  }

  const normalizeSurcharge = (v: number | undefined) => {
    if (v == null || !Number.isFinite(v)) return 0;
    if (v <= 2) return Math.min(100, v * 10);
    return Math.max(0, Math.min(100, v));
  };
  let surchargePct = 0;
  if (billingCycle <= 7) surchargePct = normalizeSurcharge(billingOptions.billingSurcharge7d);
  else if (billingCycle <= 14) surchargePct = normalizeSurcharge(billingOptions.billingSurcharge14d);
  if (surchargePct > 0) {
    const pctLabel = Number.isInteger(surchargePct) ? String(surchargePct) : surchargePct.toFixed(1);
    items.push({
      label: translate("configuratorCostBillingSurcharge").replace("{percent}", pctLabel),
      amount: priceMonthlyVal * cycleFactor * (surchargePct / 100),
    });
  }

  return items;
}
