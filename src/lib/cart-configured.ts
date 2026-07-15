import type { CartItem } from "./cart-service";
import type {
  ProductProviderOptions,
  ShopProductDetail,
  ShopUpgradeConfig,
} from "./shop-product-detail";
import { numSpec } from "./shop-product-detail";
import { productUsesMbResources } from "./product-pricing";

export function buildCustomizationPayload(
  product: ShopProductDetail,
  options: ProductProviderOptions,
  usesMb: boolean,
  upgradeConfig: ShopUpgradeConfig | null,
): Pick<CartItem, "customization" | "customizationPrices" | "configuredSpecs" | "resourceSpecsUnit"> {
  const baseVcores = numSpec(product.vcores, 2);
  const baseMemory = numSpec(product.memory, 4);
  const baseStorage = numSpec(product.storage, 50);

  const customization: NonNullable<CartItem["customization"]> = {};

  if (options.vcores > baseVcores) customization.vcores = options.vcores - baseVcores;
  if (options.memory > baseMemory) {
    const rawDelta = options.memory - baseMemory;
    customization.memory = usesMb ? Math.round(rawDelta / 1024) : rawDelta;
  }
  if (options.storage > baseStorage) {
    const rawDelta = options.storage - baseStorage;
    customization.storage = usesMb ? Math.round(rawDelta / 1024) : rawDelta;
  }
  if (product.provider?.type?.toUpperCase() === "PROXMOX" && (options.trafficAddonTb ?? 0) > 0) {
    customization.bandwidth = options.trafficAddonTb;
  }
  if ((options.speedUpgradeGbit ?? 0) > 0) customization.speedGbit = options.speedUpgradeGbit;

  const rp = upgradeConfig?.resourcePricing;
  const storageStep = rp?.storage?.step ?? 10;
  const customizationPrices = rp
    ? {
        vcores: rp.vcores?.upgradePrice,
        memory: rp.memory?.upgradePrice,
        storage: rp.storage?.upgradePrice != null ? rp.storage.upgradePrice / storageStep : undefined,
      }
    : undefined;

  return {
    customization: Object.keys(customization).length ? customization : undefined,
    customizationPrices,
    configuredSpecs: {
      vcores: options.vcores,
      memory: options.memory,
      storage: options.storage,
    },
    ...(usesMb ? { resourceSpecsUnit: "mb" as const } : {}),
  };
}

export function buildConfiguredCartItem(args: {
  product: ShopProductDetail;
  options: ProductProviderOptions & { billingCycle?: number; minNetworkMBs?: number };
  priceMonthly: number;
  categoryId: string;
  categoryName?: string;
  usesMb: boolean;
  upgradeConfig: ShopUpgradeConfig | null;
  billingCycle?: number;
  billingMode?: "PREPAID" | "CONTRACT";
  contractTermMonths?: number;
}): Omit<CartItem, "lineId"> {
  const { product, options, priceMonthly, categoryId, categoryName, usesMb, upgradeConfig } = args;
  const billingCycle = args.billingCycle ?? options.billingCycle ?? 30;
  const configured = buildCustomizationPayload(product, options, usesMb, upgradeConfig);

  return {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    categoryId,
    categoryName,
    quantity: 1,
    billingCycle,
    priceMonthly,
    priceYearly: product.priceYearly ?? null,
    itemType: "new",
    setupFee: product.setupFee,
    ...(args.billingMode ? { billingMode: args.billingMode } : {}),
    ...(args.contractTermMonths != null ? { contractTermMonths: args.contractTermMonths } : {}),
    ...(options.selectedLocationId ? { locationId: options.selectedLocationId } : {}),
    billingOptions: {
      billingDiscountPerMonth: product.billingDiscountPerMonth,
      billingSurcharge7d: product.billingSurcharge7d,
      billingSurcharge14d: product.billingSurcharge14d,
    },
    ...configured,
  };
}

export function buildProductCartItem(args: {
  product: ShopProductDetail;
  options: ProductProviderOptions;
  priceMonthly: number;
  billingCycle: number;
  categoryId: string;
  categoryName?: string;
  upgradeConfig: ShopUpgradeConfig | null;
  billingMode?: "PREPAID" | "CONTRACT";
  contractTermMonths?: number;
}): Omit<CartItem, "lineId"> {
  const usesMb = productUsesMbResources(args.product);
  return buildConfiguredCartItem({ ...args, usesMb });
}
