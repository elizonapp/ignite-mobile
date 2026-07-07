export type CatalogProduct = {
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
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  products: CatalogProduct[];
  children: Array<{ id: string; name: string; products: CatalogProduct[] }>;
};

export type ProductsResponse = {
  success: boolean;
  categories?: CatalogCategory[];
};

/** Verfügbare Abrechnungszyklen in Tagen. */
export type BillingCycleDays = 30 | 90 | 365;

export type CheckoutStep = 0 | 1 | 2;
