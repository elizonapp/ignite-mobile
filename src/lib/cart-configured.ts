import { api } from "./api";
import type { CartCustomization, CartItem } from "./cart-service";
import type {
  InvalidUpgradeFields,
  ProductProviderOptions,
  ShopProductDetail,
  ShopUpgradeConfig,
} from "./shop-product-detail";
import { numSpec } from "./shop-product-detail";
import { productUsesMbResources } from "./product-pricing";
import { calculatePleskSurcharge } from "./plesk-pricing";

export function buildCustomizationPayload(
  product: ShopProductDetail,
  options: ProductProviderOptions,
  usesMb: boolean,
  upgradeConfig: ShopUpgradeConfig | null,
): Pick<CartItem, "customization" | "customizationPrices" | "configuredSpecs" | "resourceSpecsUnit"> {
  const baseVcores = numSpec(product.vcores, 2);
  const baseMemory = numSpec(product.memory, 4);
  const baseStorage = numSpec(product.storage, 50);
  const isPlesk = product.provider?.type?.toUpperCase() === "PLESK";

  const customization: CartCustomization = {};

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
  if ((options.maxDomains ?? 0) > (product.maxDomains ?? 0)) {
    customization.maxDomains = (options.maxDomains ?? 0) - (product.maxDomains ?? 0);
  }
  if ((options.maxMailboxesPerDomain ?? 0) > (product.maxMailboxesPerDomain ?? 0)) {
    customization.maxMailboxesPerDomain =
      (options.maxMailboxesPerDomain ?? 0) - (product.maxMailboxesPerDomain ?? 0);
  }
  if ((options.storagePerMailboxGb ?? 0) > (product.storagePerMailboxGb ?? 0)) {
    customization.storagePerMailboxGb =
      (options.storagePerMailboxGb ?? 0) - (product.storagePerMailboxGb ?? 0);
  }
  if ((options.maxAliasesPerDomain ?? 0) > (product.maxAliasesPerDomain ?? 0)) {
    customization.maxAliasesPerDomain =
      (options.maxAliasesPerDomain ?? 0) - (product.maxAliasesPerDomain ?? 0);
  }
  if (options.domain?.trim()) customization.domain = options.domain.trim();
  if (options.selectedLocationId) customization.location = options.selectedLocationId;
  if (options.appType?.trim()) customization.appType = options.appType.trim();
  if (options.domainMode) customization.domainMode = options.domainMode;
  if (typeof options.storageGb === "number" && options.storageGb > 0) {
    customization.storageGb = options.storageGb;
  }

  const rp = upgradeConfig?.resourcePricing;
  let pleskSurcharge: number | undefined;

  if (isPlesk) {
    const baseStoragePerDomain =
      typeof product.storagePerDomainGb === "number" ? product.storagePerDomainGb : 5;
    const baseDns = typeof product.dnsManagement === "number" ? product.dnsManagement : -1;
    const selectedStoragePerDomain = options.storagePerDomainGb ?? baseStoragePerDomain;
    if (selectedStoragePerDomain > baseStoragePerDomain) {
      customization.storagePerDomainGb = selectedStoragePerDomain - baseStoragePerDomain;
    }
    const selectedDns = options.dnsManagement ?? Math.max(0, baseDns);
    if (baseDns >= 0 && selectedDns >= 1 && baseDns < 1) {
      customization.dnsManagement = 1;
    }
    if (options.pleskLocation?.trim()) {
      customization.location = options.pleskLocation.trim();
    }
    delete customization.domain;
    if (rp) {
      const baseLimits = {
        maxDomains: product.maxDomains ?? 1,
        storagePerDomainGb: baseStoragePerDomain,
        maxMailboxesPerDomain: product.maxMailboxesPerDomain ?? -1,
        storagePerMailboxGb: product.storagePerMailboxGb ?? -1,
        dnsManagement: baseDns,
      };
      pleskSurcharge = calculatePleskSurcharge(
        baseLimits,
        {
          maxDomains: options.maxDomains ?? baseLimits.maxDomains,
          storagePerDomainGb: selectedStoragePerDomain,
          maxMailboxesPerDomain: options.maxMailboxesPerDomain ?? baseLimits.maxMailboxesPerDomain,
          storagePerMailboxGb: options.storagePerMailboxGb ?? baseLimits.storagePerMailboxGb,
          dnsManagement: selectedDns,
        },
        rp,
      );
    }
  }

  const storageStep = rp?.storage?.step ?? 10;
  const usePleskSurcharge = pleskSurcharge != null;
  const customizationPrices = rp
    ? {
        vcores: rp.vcores?.upgradePrice,
        memory: rp.memory?.upgradePrice,
        storage: rp.storage?.upgradePrice != null ? rp.storage.upgradePrice / storageStep : undefined,
        maxDomains: usePleskSurcharge ? undefined : rp.maxDomains?.upgradePrice,
        maxMailboxesPerDomain: usePleskSurcharge ? undefined : rp.maxMailboxesPerDomain?.upgradePrice,
        storagePerMailboxGb: usePleskSurcharge ? undefined : rp.storagePerMailboxGb?.upgradePrice,
        maxAliasesPerDomain: usePleskSurcharge ? undefined : rp.maxAliasesPerDomain?.upgradePrice,
        storagePerDomainGb: usePleskSurcharge ? undefined : rp.storagePerDomainGb?.upgradePrice,
        dnsManagement: usePleskSurcharge ? undefined : rp.dnsManagement?.upgradePrice,
        pleskSurcharge: usePleskSurcharge && (pleskSurcharge ?? 0) > 0 ? pleskSurcharge : undefined,
      }
    : undefined;

  const providerType = product.provider?.type?.toUpperCase() ?? "";
  const configuredSpecs =
    providerType === "PLESK" || providerType === "MAILCOW"
      ? {
          maxDomains: options.maxDomains ?? product.maxDomains ?? 0,
          storagePerDomainGb: options.storagePerDomainGb ?? product.storagePerDomainGb ?? 0,
          maxMailboxesPerDomain: options.maxMailboxesPerDomain ?? product.maxMailboxesPerDomain,
          storagePerMailboxGb: options.storagePerMailboxGb ?? product.storagePerMailboxGb,
          maxAliasesPerDomain: options.maxAliasesPerDomain ?? product.maxAliasesPerDomain,
          dnsManagement: options.dnsManagement ?? product.dnsManagement,
        }
      : providerType === "PLOI"
        ? {
            storageGb: options.storageGb ?? product.storageGb ?? 0,
            databases: options.databases ?? product.databases ?? 0,
            domains: options.domains ?? product.domains ?? 0,
          }
        : {
            vcores: options.vcores,
            memory: options.memory,
            storage: options.storage,
          };

  return {
    customization: Object.keys(customization).length ? customization : undefined,
    customizationPrices,
    configuredSpecs,
    ...(usesMb ? { resourceSpecsUnit: "mb" as const } : {}),
  };
}

export function computeInvalidUpgradeFieldFlags(
  product: ShopProductDetail,
  options: ProductProviderOptions,
): InvalidUpgradeFields | null {
  const baseVcores = numSpec(product.vcores, 2);
  const baseMemory = numSpec(product.memory, 4);
  const baseStorage = numSpec(product.storage, 50);
  const baseStoragePerDomain =
    typeof product.storagePerDomainGb === "number" ? product.storagePerDomainGb : 5;
  const baseDns = typeof product.dnsManagement === "number" ? product.dnsManagement : -1;
  const flagged: InvalidUpgradeFields = {
    vcores: options.vcores > baseVcores,
    memory: options.memory > baseMemory,
    storage: options.storage > baseStorage,
    maxDomains: (options.maxDomains ?? 0) > (product.maxDomains ?? 0),
    maxMailboxesPerDomain:
      (options.maxMailboxesPerDomain ?? 0) > (product.maxMailboxesPerDomain ?? 0),
    storagePerMailboxGb:
      (options.storagePerMailboxGb ?? 0) > (product.storagePerMailboxGb ?? 0),
    maxAliasesPerDomain:
      (options.maxAliasesPerDomain ?? 0) > (product.maxAliasesPerDomain ?? 0),
    storagePerDomainGb: (options.storagePerDomainGb ?? 0) > baseStoragePerDomain,
    dnsManagement: baseDns >= 0 && (options.dnsManagement ?? 0) >= 1 && baseDns < 1,
  };
  if (
    !flagged.vcores &&
    !flagged.memory &&
    !flagged.storage &&
    !flagged.maxDomains &&
    !flagged.maxMailboxesPerDomain &&
    !flagged.storagePerMailboxGb &&
    !flagged.maxAliasesPerDomain &&
    !flagged.storagePerDomainGb &&
    !flagged.dnsManagement
  ) {
    return null;
  }
  return flagged;
}

export async function validateConfiguredNewItem(
  product: ShopProductDetail,
  customization: CartCustomization | undefined,
): Promise<{ ok: boolean; unavailable: boolean; lineId: string }> {
  const lineId = `cfg-${product.id}`;
  try {
    const validateData = await api.checkout.validate([
      {
        lineId,
        productId: product.id,
        productName: product.name,
        itemType: "new",
        ...(customization && Object.keys(customization).length ? { customization } : {}),
      },
    ]);
    const unavailable = Array.isArray(validateData?.unavailable)
      ? validateData.unavailable.some((u: { lineId?: string }) => u?.lineId === lineId)
      : false;
    return { ok: true, unavailable, lineId };
  } catch {
    return { ok: false, unavailable: false, lineId };
  }
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
    ...(options.selectedTemplateId != null ? { templateId: options.selectedTemplateId } : {}),
    ...(options.additionalIPv4 > 0 ? { additionalIPv4: options.additionalIPv4 } : {}),
    ...(options.additionalIPv6 > 0 ? { additionalIPv6: options.additionalIPv6 } : {}),
    ...(!options.includeIPv4 ? { includeIPv4: false } : {}),
    ...(!options.includeIPv6 ? { includeIPv6: false } : {}),
    ...(options.sshKeyIds?.length ? { sshKeyIds: options.sshKeyIds } : {}),
    ...(options.eggId != null ? { eggId: options.eggId } : {}),
    ...(options.nestId != null ? { nestId: options.nestId } : {}),
    ...(options.dockerImage ? { dockerImage: options.dockerImage } : {}),
    ...(options.environment && Object.keys(options.environment).length > 0
      ? { environment: options.environment }
      : {}),
    ...(options.providerVariables && Object.keys(options.providerVariables).length > 0
      ? { providerVariables: options.providerVariables }
      : {}),
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

/** Serialize cart item for /api/cart/calculate and /api/checkout. */
export function cartItemToApiPayload(item: CartItem): Record<string, unknown> {
  const itemType = item.itemType ?? "new";
  return {
    lineId: item.lineId,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    billingCycle: item.billingCycle,
    itemType,
    ...(itemType === "renewal" && item.serviceId ? { serviceId: item.serviceId } : {}),
    ...(itemType === "renewal" && item.subscriptionId ? { subscriptionId: item.subscriptionId } : {}),
    ...(itemType === "renewal" && item.daysExtension != null ? { daysExtension: item.daysExtension } : {}),
    ...(itemType === "upgrade" && item.serviceId ? { serviceId: item.serviceId } : {}),
    ...(item.locationId ? { locationId: item.locationId } : {}),
    ...(item.templateId != null ? { templateId: item.templateId } : {}),
    ...(item.additionalIPv4 != null ? { additionalIPv4: item.additionalIPv4 } : {}),
    ...(item.additionalIPv6 != null ? { additionalIPv6: item.additionalIPv6 } : {}),
    ...(item.includeIPv4 === false ? { includeIPv4: false } : {}),
    ...(item.includeIPv6 === false ? { includeIPv6: false } : {}),
    ...(item.sshKeyIds?.length ? { sshKeyIds: item.sshKeyIds } : {}),
    ...(item.eggId != null ? { eggId: item.eggId } : {}),
    ...(item.nestId != null ? { nestId: item.nestId } : {}),
    ...(item.dockerImage ? { dockerImage: item.dockerImage } : {}),
    ...(item.environment ? { environment: item.environment } : {}),
    ...(item.providerVariables ? { providerVariables: item.providerVariables } : {}),
    ...(item.customization ? { customization: item.customization } : {}),
    ...(item.customizationPrices ? { customizationPrices: item.customizationPrices } : {}),
    ...(item.configuredSpecs ? { configuredSpecs: item.configuredSpecs } : {}),
    ...(item.resourceSpecsUnit ? { resourceSpecsUnit: item.resourceSpecsUnit } : {}),
    ...(item.billingOptions ? { billingOptions: item.billingOptions } : {}),
    ...(item.setupFee != null ? { setupFee: item.setupFee } : {}),
    ...(item.billingMode ? { billingMode: item.billingMode } : {}),
    ...(item.contractTermMonths != null ? { contractTermMonths: item.contractTermMonths } : {}),
  };
}
