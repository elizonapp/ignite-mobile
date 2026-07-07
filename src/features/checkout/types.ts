import type { ShopCategory, ShopProduct } from "../../lib/shop-catalog";

export type CatalogProduct = ShopProduct;
export type CatalogCategory = ShopCategory;

export type ProductsResponse = {
  success: boolean;
  categories?: CatalogCategory[];
};

/** Verfügbare Abrechnungszyklen in Tagen. */
export type BillingCycleDays = 30 | 90 | 365;

export type CheckoutStep = 0 | 1 | 2;

export function flattenProducts(categories: CatalogCategory[]): CatalogProduct[] {
  const walk = (category: CatalogCategory): CatalogProduct[] => [
    ...category.products,
    ...(category.children ?? []).flatMap(walk),
  ];
  return categories.flatMap(walk);
}
