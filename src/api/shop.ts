import { ResourceClient } from "./resource-client";

export class ShopResource extends ResourceClient {
  products(lang?: string) {
    return this.get<{ success: boolean; categories?: unknown[] }>("/api/products", { lang });
  }

  countries() {
    return this.get<{
      success: boolean;
      countries: Array<{ countryCode: string; countryName: string; isDefault?: boolean }>;
    }>("/api/public/countries");
  }
}
