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
  priceMonthly?: number | null;
  priceYearly?: number | null;
  vcores?: number;
  memory?: number;
  storage?: number;
  highlights?: string[];
  soldOut?: boolean;
};

export type ShopCategory = {
  key: string;
  id?: string;
  name: string;
  description?: string | null;
  tagline?: string | null;
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
    .filter((category) => isCategoryVisibleForAccount(category, isBusiness))
    .map((category) => ({
      ...category,
      products: (category.products ?? []).filter((product) => !product.soldOut),
      children: filterCategoryTree(category.children ?? [], isBusiness),
    }))
    .filter(
      (category) =>
        category.products.length > 0 ||
        (category.children?.length ?? 0) > 0,
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
