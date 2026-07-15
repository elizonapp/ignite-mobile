import { Loader2 } from "lucide-react";

import { ProviderFieldGrid } from "../provider/ProviderFieldGrid";
import { useProductProviderView } from "../../hooks/useProductProviderView";
import { useI18n } from "../../i18n";
import type { ShopBusinessPricing } from "../../lib/shop-catalog";
import type { ProductProviderOptions, ShopProductDetail, ShopUpgradeConfig } from "../../lib/shop-product-detail";
import { ShopProductOrderForm } from "./ShopProductOrderForm";

type ShopProductPanelProps = {
  categoryKey: string;
  product: ShopProductDetail;
  upgradeConfig: ShopUpgradeConfig | null;
  options: ProductProviderOptions;
  onOptionsChange: (options: ProductProviderOptions) => void;
  billingCycle: number;
  onBillingCycleChange: (cycle: number) => void;
  priceMonthly: number;
  periodPrice: number;
  isBusiness: boolean;
  businessPricing?: ShopBusinessPricing | null;
  defaultTaxName?: string;
  hideBillingCycle?: boolean;
};

export function ShopProductPanel(props: ShopProductPanelProps) {
  const { t } = useI18n();
  const { view, loading, error, refetch } = useProductProviderView(props.categoryKey, props.product.slug);

  const readOnlyFields = view?.fields.filter((field) => {
    const owned = new Set(["vcpu", "cpu", "memory", "storage", "storageType", "network"]);
    return field.visible !== false && !owned.has(field.key);
  });

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-(--elizon-primary)" />
        </div>
      ) : error ? (
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
          <p>{error}</p>
          <button type="button" onClick={() => void refetch()} className="btn-secondary mt-3 rounded-xl px-4 py-2 text-sm">
            {t("retry")}
          </button>
        </div>
      ) : readOnlyFields && readOnlyFields.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-(--text-primary)">{t("productDetailFeatures")}</h2>
          <ProviderFieldGrid fields={readOnlyFields} />
        </section>
      ) : null}

      <ShopProductOrderForm
        {...props}
        onChange={props.onOptionsChange}
      />
    </div>
  );
}
