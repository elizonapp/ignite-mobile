import type { CartItem } from "./cart-service";
import type {
  ConfiguratorProviderOptions,
  ShopProductDetail,
  ShopUpgradeConfig,
} from "./shop-product-detail";
import { numSpec } from "./shop-product-detail";

export function buildCustomizationPayload(
  product: ShopProductDetail,
  options: Pick<ConfiguratorProviderOptions, "vcores" | "memory" | "storage">,
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
  options: ConfiguratorProviderOptions;
  priceMonthly: number;
  categoryId: string;
  categoryName?: string;
  usesMb: boolean;
  upgradeConfig: ShopUpgradeConfig | null;
}): Omit<CartItem, "lineId"> {
  const { product, options, priceMonthly, categoryId, categoryName, usesMb, upgradeConfig } = args;
  const configured = buildCustomizationPayload(product, options, usesMb, upgradeConfig);

  return {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    categoryId,
    categoryName,
    quantity: 1,
    billingCycle: options.billingCycle,
    priceMonthly,
    priceYearly: product.priceYearly ?? null,
    itemType: "new",
    setupFee: product.setupFee,
    ...(options.selectedLocationId ? { locationId: options.selectedLocationId } : {}),
    billingOptions: {
      billingDiscountPerMonth: product.billingDiscountPerMonth,
      billingSurcharge7d: product.billingSurcharge7d,
      billingSurcharge14d: product.billingSurcharge14d,
    },
    ...configured,
  };
}
