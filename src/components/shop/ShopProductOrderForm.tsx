"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "../../i18n";
import { api } from "../../lib/api";
import type { ShopBusinessPricing } from "../../lib/shop-catalog";
import {
  numSpec,
  type ProductProviderOptions,
  type ShopLocationOption,
  type ShopProductDetail,
  type ShopTemplateOption,
  type ShopUpgradeConfig,
} from "../../lib/shop-product-detail";
import { filterAllowedBillingCycles } from "../../lib/product-pricing";
import { displayShopPrice } from "../../features/shop/shop-pricing";
import { SpecStepper } from "./wizard-shell";

type ShopProductOrderFormProps = {
  product: ShopProductDetail;
  upgradeConfig: ShopUpgradeConfig | null;
  options: ProductProviderOptions;
  onChange: (options: ProductProviderOptions) => void;
  billingCycle: number;
  onBillingCycleChange: (cycle: number) => void;
  priceMonthly: number;
  periodPrice: number;
  isBusiness: boolean;
  businessPricing?: ShopBusinessPricing | null;
  defaultTaxName?: string;
  hideBillingCycle?: boolean;
};

function isResourceEditable(
  product: ShopProductDetail,
  upgradeConfig: ShopUpgradeConfig | null,
  key: "vcores" | "memory" | "storage",
): boolean {
  const allowFlag =
    key === "vcores"
      ? product.allowCpuCustomization
      : key === "memory"
        ? product.allowRamCustomization
        : product.allowStorageCustomization;
  const pricing = upgradeConfig?.resourcePricing?.[key];
  return Boolean(
    (allowFlag || upgradeConfig?.allowPrePurchaseUpgrade) &&
      (pricing?.upgradePrice != null || pricing?.allowDowngrade),
  );
}

export function ShopProductOrderForm({
  product,
  upgradeConfig,
  options,
  onChange,
  billingCycle,
  onBillingCycleChange,
  priceMonthly,
  periodPrice,
  isBusiness,
  businessPricing,
  defaultTaxName,
  hideBillingCycle = false,
}: ShopProductOrderFormProps) {
  const { t, lang } = useI18n();
  const providerType = product.provider?.type?.toUpperCase() ?? "CUSTOM";
  const usesMb = providerType === "PTERODACTYL";

  const [locations, setLocations] = useState<ShopLocationOption[]>([]);
  const [templates, setTemplates] = useState<ShopTemplateOption[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const allowedCycles = useMemo(() => filterAllowedBillingCycles(product), [product]);
  const billingOptions = useMemo(() => getBillingOptions(product), [product]);

  const baseVcores = numSpec(product.vcores, 2);
  const baseMemory = numSpec(product.memory, 4);
  const baseStorage = numSpec(product.storage, 50);
  const rp = upgradeConfig?.resourcePricing;

  const maxVcores = Math.max(baseVcores, rp?.vcores?.max ?? baseVcores);
  const maxMemory = Math.max(baseMemory, rp?.memory?.max ?? baseMemory);
  const maxStorage = Math.max(baseStorage, rp?.storage?.max ?? baseStorage);
  const memoryStep = usesMb ? 1024 : 1;
  const storageStep = usesMb ? (rp?.storage?.step ?? 10240) : (rp?.storage?.step ?? 10);
  const memoryUnit = usesMb ? "MB" : "GB";
  const storageUnit = usesMb ? "MB" : "GB";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingExtras(true);
      try {
        const [locRes, tplRes] = await Promise.all([
          api.shop.productLocations(product.id),
          providerType === "PROXMOX" ? api.shop.productTemplates(product.id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (locRes?.success) {
          const list = Array.isArray(locRes.locations) ? locRes.locations : [];
          setLocations(list);
          if (list.length === 1 && !options.selectedLocationId) {
            onChange({ ...options, selectedLocationId: list[0]?.id });
          }
        }
        if (tplRes?.success && Array.isArray(tplRes.templates)) {
          setTemplates(tplRes.templates);
        }
      } finally {
        if (!cancelled) setLoadingExtras(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id, providerType]);

  const fmt = (value: number) => displayShopPrice(value, lang, isBusiness, businessPricing);

  return (
    <div className="space-y-6">
      {(isResourceEditable(product, upgradeConfig, "vcores") ||
        isResourceEditable(product, upgradeConfig, "memory") ||
        isResourceEditable(product, upgradeConfig, "storage")) && (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">{t("configuratorStepPerformanceTitle")}</h3>
          {isResourceEditable(product, upgradeConfig, "vcores") ? (
            <SpecStepper
              label="vCPU"
              value={options.vcores}
              unit=""
              min={baseVcores}
              max={maxVcores}
              step={1}
              onChange={(vcores) => onChange({ ...options, vcores })}
            />
          ) : null}
          {isResourceEditable(product, upgradeConfig, "memory") ? (
            <SpecStepper
              label="RAM"
              value={options.memory}
              unit={memoryUnit}
              min={baseMemory}
              max={maxMemory}
              step={memoryStep}
              onChange={(memory) => onChange({ ...options, memory })}
            />
          ) : null}
          {isResourceEditable(product, upgradeConfig, "storage") ? (
            <SpecStepper
              label={t("shopStorage")}
              value={options.storage}
              unit={storageUnit}
              min={baseStorage}
              max={maxStorage}
              step={storageStep}
              onChange={(storage) => onChange({ ...options, storage })}
            />
          ) : null}
        </section>
      )}

      {providerType === "PROXMOX" && Array.isArray(product.speedUpgradeOptions) && product.speedUpgradeOptions.length > 0 ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">{t("configuratorStepNetworkUpgradesTitle")}</label>
          <select
            value={options.speedUpgradeGbit}
            onChange={(event) => onChange({ ...options, speedUpgradeGbit: Number(event.target.value) })}
            className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
          >
            <option value={0}>{t("configuratorMinNetworkSpeedAny")}</option>
            {product.speedUpgradeOptions.map((row) => (
              <option key={row.gbit} value={row.gbit}>
                {row.gbit} Gbit/s (+{fmt(row.priceGross)})
              </option>
            ))}
          </select>
          {(product.maxTrafficAddonTb ?? 0) > 0 ? (
            <SpecStepper
              label={t("configuratorTrafficAddonLabel")}
              value={options.trafficAddonTb}
              unit="TB"
              min={0}
              max={product.maxTrafficAddonTb ?? 0}
              step={1}
              onChange={(trafficAddonTb) => onChange({ ...options, trafficAddonTb })}
            />
          ) : null}
        </section>
      ) : null}

      {providerType === "PTERODACTYL" && (product.pterodactylEggs?.length ?? 0) > 0 ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">{t("configuratorStepSystemTitle")}</label>
          <div className="grid gap-2">
            {(product.pterodactylEggs ?? []).map((egg) => (
              <button
                key={egg.eggId}
                type="button"
                onClick={() => onChange({ ...options, eggId: egg.eggId, nestId: egg.nestId })}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${
                  options.eggId === egg.eggId
                    ? "border-(--elizon-primary) bg-(--elizon-primary)/10"
                    : "border-(--border) text-(--text-secondary)"
                }`}
              >
                {egg.displayName ?? egg.name ?? `Egg ${egg.eggId}`}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {loadingExtras ? (
        <div className="flex items-center gap-2 text-sm text-(--text-muted)">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      ) : null}

      {!loadingExtras && locations.length > 0 ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">{t("configuratorLocationLabel")}</label>
          <select
            value={options.selectedLocationId ?? ""}
            onChange={(event) => onChange({ ...options, selectedLocationId: event.target.value || undefined })}
            className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
          >
            <option value="">{t("configuratorLocationPlaceholder")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {location.city ? ` · ${location.city}` : ""}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {!loadingExtras && templates.length > 0 ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">{t("configuratorOsTemplateLabel")}</label>
          <select
            value={options.selectedTemplateId ?? ""}
            onChange={(event) =>
              onChange({
                ...options,
                selectedTemplateId: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
          >
            <option value="">{t("configuratorOsTemplatePlaceholder")}</option>
            {templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.displayName || template.name}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {providerType === "PROXMOX" && (upgradeConfig?.additionalIpsPricePerMonth ?? 0) > 0 ? (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">{t("configuratorStepAccessTitle")}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.includeIPv4}
              onChange={(event) => onChange({ ...options, includeIPv4: event.target.checked })}
            />
            IPv4
          </label>
          <SpecStepper
            label={t("configuratorAdditionalIpv4")}
            value={options.additionalIPv4}
            unit=""
            min={0}
            max={Number(product.providerCapabilities?.maxIPv4 ?? 5)}
            step={1}
            onChange={(additionalIPv4) => onChange({ ...options, additionalIPv4 })}
          />
          <SpecStepper
            label={t("configuratorAdditionalIpv6")}
            value={options.additionalIPv6}
            unit=""
            min={0}
            max={Number(product.providerCapabilities?.maxIPv6 ?? 3)}
            step={1}
            onChange={(additionalIPv6) => onChange({ ...options, additionalIPv6 })}
          />
        </section>
      ) : null}

      {!hideBillingCycle ? (
      <section className="glass space-y-2 p-4">
        <label className="text-sm font-medium text-(--text-primary)">{t("productBillingInterval")}</label>
        <select
          value={billingCycle}
          onChange={(event) => onBillingCycleChange(Number(event.target.value))}
          className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
        >
          {allowedCycles.map((cycle) => (
            <option key={cycle} value={cycle}>
              {cycle} {t("days")}
            </option>
          ))}
        </select>
        <div className="rounded-xl border border-(--border) bg-(--bg-elevated) p-3">
          <p className="text-xs text-(--text-muted)">{t("productBillingIntervalPopoverSubtitle")}</p>
          <p className="text-xl font-bold text-(--elizon-primary)">{fmt(periodPrice)}</p>
          <p className="text-xs text-(--text-muted)">
            ≈ {fmt(priceMonthly)} {t("productPerMonth")}
          </p>
        </div>
      </section>
      ) : null}
    </div>
  );
}
