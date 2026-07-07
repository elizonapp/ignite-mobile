import type { ShopProductDetail, ShopUpgradeConfig } from "../lib/shop-product-detail";
import { ResourceClient } from "./resource-client";

export class ShopResource extends ResourceClient {
  products(lang?: string) {
    return this.get<{
      success: boolean;
      categories?: unknown[];
      businessPricing?: { upchargePercent: number; taxRatePercent: number } | null;
      defaultTaxName?: string;
    }>("/api/products", { lang });
  }

  category(categoryKey: string, lang?: string) {
    return this.get<{
      success: boolean;
      category?: unknown;
      businessPricing?: { upchargePercent: number; taxRatePercent: number } | null;
      defaultTaxName?: string;
    }>(`/api/products/${encodeURIComponent(categoryKey)}`, { lang });
  }

  countries() {
    return this.get<{
      success: boolean;
      countries: Array<{ countryCode: string; countryName: string; isDefault?: boolean }>;
    }>("/api/public/countries");
  }

  upgradeConfig(categoryId: string) {
    return this.get<{ success: boolean; config?: ShopUpgradeConfig | null }>(
      `/api/categories/${encodeURIComponent(categoryId)}/upgrade-config`,
    );
  }

  productDetail(categoryKey: string, productSlug: string, lang?: string) {
    return this.get<{
      success: boolean;
      product?: ShopProductDetail & { category?: unknown };
      category?: unknown;
      businessPricing?: { upchargePercent: number; taxRatePercent: number } | null;
      defaultTaxName?: string;
    }>(
      `/api/products/${encodeURIComponent(categoryKey)}/${encodeURIComponent(productSlug)}`,
      { lang },
    );
  }

  productLocations(productId: string) {
    return this.get<{ success: boolean; locations?: Array<{ id: string; name: string; city?: string; country?: string }> }>(
      "/api/products/locations",
      { productIds: productId },
    );
  }

  productView(categoryKey: string, productSlug: string) {
    return this.get<Record<string, unknown>>(
      `/api/products/${encodeURIComponent(categoryKey)}/${encodeURIComponent(productSlug)}/view`,
    );
  }

  productTemplates(productId: string) {
    return this.get<{ success: boolean; templates?: Array<{ templateId: number; name: string; displayName: string; cloudInitSupport: boolean; cloudInitUsername?: string }> }>(
      "/api/products/templates",
      { productId },
    );
  }

  publicSettings() {
    return this.get<{ success: boolean; settings?: Record<string, unknown> }>("/api/public-settings");
  }
}
