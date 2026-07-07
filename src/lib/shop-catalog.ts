export type AdvisorQuestion = {
  id: string;
  text: Record<string, string> | string;
  options: Array<{
    id: string;
    text: Record<string, string> | string;
    scores?: Record<string, number>;
  }>;
};

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  chip?: string | null;
  priceMonthly?: number | string | null;
  priceYearly?: number | null;
  vcores?: number | string;
  memory?: number | string;
  storage?: number | string;
  highlights?: string[];
  soldOut?: boolean;
  backgroundImageUrls?: string[];
  schemaCardFields?: Array<{ label: string; value: string }>;
};

export type ShopCategory = {
  key: string;
  id?: string;
  name: string;
  description?: string | null;
  tagline?: string | null;
  backgroundImageUrls?: string[];
  products: ShopProduct[];
  children?: ShopCategory[];
  hiddenForBusiness?: boolean;
  hiddenForPrivate?: boolean;
  configuratorEnabled?: boolean;
  provider?: { id: string; type: string; name: string };
  consultationConfig?: Record<string, unknown>;
  consultationFlow?: {
    enabled?: boolean;
    title?: Record<string, string>;
    description?: Record<string, string>;
    questions?: Array<{
      id: string;
      text: Record<string, string>;
      options: Array<{
        id: string;
        text: Record<string, string>;
        scoreEntries?: Array<{ targetCategoryKey: string; points: number }>;
      }>;
    }>;
  };
};

export type ShopBusinessPricing = {
  upchargePercent: number;
  taxRatePercent: number;
};

type PriceNode = {
  products?: Array<{ priceMonthly?: number | string | null; soldOut?: boolean }>;
  children?: PriceNode[];
};

export function isBusinessAccount(accountType?: string | null): boolean {
  return (accountType ?? "").toUpperCase() === "BUSINESS";
}

export function isCategoryVisibleForAccount(category: ShopCategory, isBusiness: boolean): boolean {
  if (isBusiness && category.hiddenForBusiness) return false;
  if (!isBusiness && category.hiddenForPrivate) return false;
  return true;
}

export function filterCategoryTree(categories: ShopCategory[], isBusiness: boolean): ShopCategory[] {
  return categories
    .map((category) => filterCategoryVisibility(category, isBusiness))
    .filter((category): category is ShopCategory => category !== null)
    .filter(
      (category) =>
        category.products.length > 0 ||
        (category.children?.length ?? 0) > 0,
    );
}

/** Keeps navigation-only subcategories (e.g. advisor parents without direct plans). */
export function filterCategoryVisibility(
  category: ShopCategory,
  isBusiness: boolean,
): ShopCategory | null {
  if (!isCategoryVisibleForAccount(category, isBusiness)) return null;

  return {
    ...category,
    products: (category.products ?? []).filter((product) => !product.soldOut),
    children: (category.children ?? [])
      .map((child) => filterCategoryVisibility(child, isBusiness))
      .filter((child): child is ShopCategory => child !== null),
  };
}

export function findLowestMonthlyPrice(node: PriceNode | null | undefined): number | null {
  if (!node) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const product of node.products ?? []) {
    if (product.soldOut) continue;
    const value = parseFloat(String(product.priceMonthly));
    if (Number.isFinite(value) && value > 0 && value < min) {
      min = value;
    }
  }
  for (const child of node.children ?? []) {
    const childMin = findLowestMonthlyPrice(child);
    if (childMin != null && childMin < min) {
      min = childMin;
    }
  }
  return Number.isFinite(min) ? min : null;
}

export function countPlansInSubtree(node: PriceNode | null | undefined): number {
  if (!node) return 0;
  let count = node.products?.length ?? 0;
  for (const child of node.children ?? []) {
    count += countPlansInSubtree(child);
  }
  return count;
}

export function pickCategoryImage(urls?: string[]): string | null {
  if (!urls?.length) return null;
  return urls[Math.floor(Math.random() * urls.length)] ?? null;
}

export function categoryShowsConfigurator(category: ShopCategory): boolean {
  const providerType = category.provider?.type?.toUpperCase();
  return Boolean(
    category.configuratorEnabled &&
      category.id &&
      category.products.length > 0 &&
      (providerType === "PROXMOX" || providerType === "PTERODACTYL"),
  );
}

export function collectProductsFromCategory(category: ShopCategory): Array<ShopProduct & { categoryName: string }> {
  const own = category.products.map((product) => ({ ...product, categoryName: category.name }));
  const nested = (category.children ?? []).flatMap((child) => collectProductsFromCategory(child));
  return [...own, ...nested];
}

export function flattenShopProducts(categories: ShopCategory[]): Array<ShopProduct & { categoryName: string }> {
  return categories.flatMap((category) => collectProductsFromCategory(category));
}
