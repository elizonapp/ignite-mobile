import { useMemo } from "react";
import { Loader2 } from "lucide-react";

import { ProviderFieldGrid } from "../provider/ProviderFieldGrid";
import { useProductProviderView } from "../../hooks/useProductProviderView";
import { useI18n } from "../../i18n";
import type { ShopBusinessPricing } from "../../lib/shop-catalog";
import type {
  InvalidUpgradeFields,
  ProductProviderOptions,
  ShopProductDetail,
  ShopUpgradeConfig,
} from "../../lib/shop-product-detail";
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
  invalidUpgradeFields?: InvalidUpgradeFields | null;
  onUpgradeFieldEdited?: (key: keyof InvalidUpgradeFields) => void;
  ipv6Pricing?: Record<string, number> | null;
};

/** Spec keys owned by the interactive order form — hide from read-only grid. */
function getFormOwnedSpecKeys(
  providerType: string,
  product: ShopProductDetail,
  upgradeConfig: ShopUpgradeConfig | null,
): Set<string> {
  const owned = new Set(["vcpu", "cpu", "memory", "storage", "storageType", "network"]);
  const type = providerType.toUpperCase();
  if (type === "MAILCOW") {
    owned.add("maxDomains");
    owned.add("maxMailboxes");
    owned.add("storagePerMailbox");
    owned.add("maxAliases");
  }
  if (type === "PLESK") {
    owned.add("maxDomains");
    owned.add("storagePerDomain");
    owned.add("storagePerDomainGb");
    owned.add("maxMailboxes");
    owned.add("maxMailboxesPerDomain");
    owned.add("storagePerMailbox");
    owned.add("storagePerMailboxGb");
    owned.add("dnsManagement");
  }
  if (type === "PROXMOX" && (product.speedUpgradeOptions?.length || product.maxTrafficAddonTb)) {
    owned.add("bandwidth");
    owned.add("traffic");
  }
  if (upgradeConfig?.allowPrePurchaseUpgrade) {
    owned.add("vcpu");
    owned.add("cpu");
  }
  return owned;
}

export function ShopProductPanel(props: ShopProductPanelProps) {
  const { t } = useI18n();
  const { view, loading, error, refetch } = useProductProviderView(
    props.categoryKey,
    props.product.slug,
  );

  const readOnlyFields = useMemo(() => {
    if (!view) return [];
    const owned = getFormOwnedSpecKeys(
      view.providerType,
      props.product,
      props.upgradeConfig,
    );
    return view.fields.filter(
      (field) => field.visible !== false && !owned.has(field.key),
    );
  }, [view, props.product, props.upgradeConfig]);

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-(--elizon-primary)" />
        </div>
      ) : error ? (
        <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="btn-secondary mt-3 rounded-xl px-4 py-2 text-sm"
          >
            {t("retry")}
          </button>
        </div>
      ) : readOnlyFields.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-(--text-primary)">{t("productDetailFeatures")}</h2>
          <ProviderFieldGrid fields={readOnlyFields} />
        </section>
      ) : null}

      <ShopProductOrderForm
        {...props}
        onChange={props.onOptionsChange}
        orderFields={view?.orderFields ?? []}
        invalidUpgradeFields={props.invalidUpgradeFields}
        onUpgradeFieldEdited={props.onUpgradeFieldEdited}
        ipv6Pricing={props.ipv6Pricing}
      />
    </div>
  );
}
