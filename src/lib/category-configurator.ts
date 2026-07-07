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
    return (Number(a.product.priceMonthly) || 0) - (Number(b.product.priceMonthly) || 0);
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
