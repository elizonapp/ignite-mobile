export type UpgradeConfigForPick = {
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

export type ConfiguratorTargetSpecs = {
  vcores: number;
  memory: number;
  storage: number;
  minNetworkMBs?: number;
};

export type ProductLikeForConfigurator = {
  id?: string;
  slug?: string;
  name?: string;
  soldOut?: boolean;
  priceMonthly: string | number;
  vcores: number | string;
  memory: number | string;
  storage: number | string;
  networkLimitMBs?: number | null;
};

function num(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeUpgradeExtra(
  product: ProductLikeForConfigurator,
  target: ConfiguratorTargetSpecs,
  pricing: NonNullable<UpgradeConfigForPick["resourcePricing"]>,
  usesMbResources: boolean,
): number | null {
  const baseVcores = num(product.vcores, 2);
  const baseMemory = num(product.memory, 4);
  const baseStorage = num(product.storage, 50);

  if (target.vcores > baseVcores && pricing.vcores?.upgradePrice == null) return null;
  if (target.memory > baseMemory && pricing.memory?.upgradePrice == null) return null;
  if (target.storage > baseStorage && pricing.storage?.upgradePrice == null) return null;

  let extra = 0;
  if (pricing.vcores?.upgradePrice && target.vcores > baseVcores) {
    extra += (target.vcores - baseVcores) * pricing.vcores.upgradePrice;
  }
  if (pricing.memory?.upgradePrice && target.memory > baseMemory) {
    const diff = usesMbResources ? (target.memory - baseMemory) / 1024 : target.memory - baseMemory;
    extra += diff * pricing.memory.upgradePrice;
  }
  if (pricing.storage?.upgradePrice && target.storage > baseStorage) {
    const step = pricing.storage.step ?? 10;
    const diff = usesMbResources ? (target.storage - baseStorage) / 1024 : target.storage - baseStorage;
    extra += (diff / step) * pricing.storage.upgradePrice;
  }

  return extra;
}

export function computeMonthlyResourceTotal(
  product: ProductLikeForConfigurator,
  target: ConfiguratorTargetSpecs,
  upgradeConfig: UpgradeConfigForPick | null,
  usesMbResources: boolean,
): number | null {
  const base = Number(product.priceMonthly) || 0;
  const baseVcores = num(product.vcores, 2);
  const baseMemory = num(product.memory, 4);
  const baseStorage = num(product.storage, 50);

  if ((target.minNetworkMBs ?? 0) > 0) {
    const speed = Number(product.networkLimitMBs ?? 0);
    if (!(speed > 0) || speed < (target.minNetworkMBs ?? 0)) return null;
  }

  const needsUpgrade =
    target.vcores > baseVcores || target.memory > baseMemory || target.storage > baseStorage;
  const pricing = upgradeConfig?.resourcePricing;

  if (needsUpgrade && !pricing) return null;

  let extra = 0;
  if (pricing) {
    const upgradeExtra = computeUpgradeExtra(product, target, pricing, usesMbResources);
    if (upgradeExtra == null) return null;
    extra = upgradeExtra;
  }

  return base + extra;
}

export function pickBaseProduct(
  products: ProductLikeForConfigurator[],
  target: ConfiguratorTargetSpecs,
  upgradeConfig: UpgradeConfigForPick | null,
  usesMbResources: boolean,
): { product: ProductLikeForConfigurator; totalMonthly: number } | null {
  const candidates: Array<{ product: ProductLikeForConfigurator; totalMonthly: number }> = [];

  for (const product of products) {
    if (product.soldOut) continue;
    const total = computeMonthlyResourceTotal(product, target, upgradeConfig, usesMbResources);
    if (total == null) continue;
    candidates.push({ product, totalMonthly: total });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.totalMonthly !== b.totalMonthly) return a.totalMonthly - b.totalMonthly;
    const pa = Number(a.product.priceMonthly) || 0;
    const pb = Number(b.product.priceMonthly) || 0;
    if (pa !== pb) return pa - pb;
    const overheadA = computeUpgradeOverhead(a.product, target, usesMbResources);
    const overheadB = computeUpgradeOverhead(b.product, target, usesMbResources);
    return overheadA - overheadB;
  });

  return candidates[0] ?? null;
}

export function getAvailableNetworkTiers(products: ProductLikeForConfigurator[]): number[] {
  const tiers = new Set<number>();
  for (const product of products) {
    if (product.soldOut) continue;
    const speed = Number(product.networkLimitMBs ?? 0);
    if (speed > 0) tiers.add(speed);
  }
  return [...tiers].sort((a, b) => a - b);
}

export function formatPortSpeed(mbs: number): string {
  const gbit = (mbs * 8) / 1000;
  if (gbit >= 1) {
    const rounded = Number.isInteger(gbit) ? gbit : Number(gbit.toFixed(1));
    return `${rounded} Gbit/s`;
  }
  return `${Math.round(mbs * 8)} Mbit/s`;
}

export const CONFIGURATOR_UPSELL_MAX_DELTA_EUR = 5;

export type ConfiguratorUpsellOffer = {
  product: ProductLikeForConfigurator;
  totalMonthly: number;
  deltaMonthly: number;
  bonuses: { vcores?: number; memory?: number; storage?: number };
};

function computeUpgradeOverhead(
  product: ProductLikeForConfigurator,
  target: ConfiguratorTargetSpecs,
  usesMbResources: boolean,
): number {
  const baseVcores = num(product.vcores, 2);
  const baseMemory = num(product.memory, 4);
  const baseStorage = num(product.storage, 50);
  const vOver = Math.max(0, target.vcores - baseVcores);
  const mOver = usesMbResources
    ? Math.max(0, target.memory - baseMemory) / 1024
    : Math.max(0, target.memory - baseMemory);
  const sOver = usesMbResources
    ? Math.max(0, target.storage - baseStorage) / 1024
    : Math.max(0, target.storage - baseStorage);
  return vOver + mOver + sOver;
}

function productCoversTargetAtBase(product: ProductLikeForConfigurator, target: ConfiguratorTargetSpecs): boolean {
  const baseVcores = num(product.vcores, 2);
  const baseMemory = num(product.memory, 4);
  const baseStorage = num(product.storage, 50);
  return baseVcores >= target.vcores && baseMemory >= target.memory && baseStorage >= target.storage;
}

function computeUpsellBonuses(
  product: ProductLikeForConfigurator,
  target: ConfiguratorTargetSpecs,
): ConfiguratorUpsellOffer["bonuses"] {
  const baseVcores = num(product.vcores, 2);
  const baseMemory = num(product.memory, 4);
  const baseStorage = num(product.storage, 50);
  const bonuses: ConfiguratorUpsellOffer["bonuses"] = {};
  if (baseVcores > target.vcores) bonuses.vcores = baseVcores - target.vcores;
  if (baseMemory > target.memory) bonuses.memory = baseMemory - target.memory;
  if (baseStorage > target.storage) bonuses.storage = baseStorage - target.storage;
  return bonuses;
}

function bonusScore(bonuses: ConfiguratorUpsellOffer["bonuses"]): number {
  return (bonuses.vcores ?? 0) + (bonuses.memory ?? 0) + (bonuses.storage ?? 0);
}

export function findConfiguratorUpsellOffer(
  picked: { product: ProductLikeForConfigurator; totalMonthly: number } | null,
  products: ProductLikeForConfigurator[],
  target: ConfiguratorTargetSpecs,
  upgradeConfig: UpgradeConfigForPick | null,
  usesMbResources: boolean,
  maxDeltaEur: number = CONFIGURATOR_UPSELL_MAX_DELTA_EUR,
): ConfiguratorUpsellOffer | null {
  if (!picked) return null;

  let best: ConfiguratorUpsellOffer | null = null;

  for (const product of products) {
    if (product.soldOut) continue;
    if (product === picked.product) continue;
    if (!productCoversTargetAtBase(product, target)) continue;

    const bonuses = computeUpsellBonuses(product, target);
    if (bonusScore(bonuses) <= 0) continue;

    const total = computeMonthlyResourceTotal(product, target, upgradeConfig, usesMbResources);
    if (total == null) continue;

    const deltaMonthly = total - picked.totalMonthly;
    if (deltaMonthly <= 0 || deltaMonthly > maxDeltaEur) continue;

    const candidate: ConfiguratorUpsellOffer = { product, totalMonthly: total, deltaMonthly, bonuses };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.deltaMonthly < best.deltaMonthly) {
      best = candidate;
      continue;
    }
    if (candidate.deltaMonthly > best.deltaMonthly) continue;

    if (bonusScore(candidate.bonuses) > bonusScore(best.bonuses)) best = candidate;
  }

  return best;
}
