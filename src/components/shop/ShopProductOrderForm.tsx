import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "../AuthProvider";
import { useRouter } from "../Router";
import { useI18n } from "../../i18n";
import { api } from "../../lib/api";
import { calculateTrafficAddonPrice } from "../../lib/traffic-pricing";
import { computePeriodPrice } from "../../lib/billing";
import type { ShopBusinessPricing } from "../../lib/shop-catalog";
import {
  formatDockerImageName,
  numSpec,
  type InvalidUpgradeFields,
  type ProductProviderOptions,
  type ShopLocationOption,
  type ShopPterodactylEgg,
  type ShopProductDetail,
  type ShopTemplateOption,
  type ShopUpgradeConfig,
} from "../../lib/shop-product-detail";
import { filterAllowedBillingCycles, getBillingOptions } from "../../lib/product-pricing";
import { displayShopPrice } from "../../features/shop/shop-pricing";
import type { ResolvedField } from "../../shared/provider-module-types";
import { SpecStepper } from "./wizard-shell";
import { EggEnvironmentFields } from "./egg-environment-fields";
import { ProviderVariableFields } from "./provider-variable-fields";

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
  orderFields?: ResolvedField[];
  invalidUpgradeFields?: InvalidUpgradeFields | null;
  onUpgradeFieldEdited?: (key: keyof InvalidUpgradeFields) => void;
  ipv6Pricing?: Record<string, number> | null;
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
  hideBillingCycle = false,
  orderFields = [],
  invalidUpgradeFields,
  onUpgradeFieldEdited,
  ipv6Pricing,
}: ShopProductOrderFormProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const providerType = product.provider?.type?.toUpperCase() ?? "CUSTOM";
  const isProxmox = providerType === "PROXMOX";
  const isPterodactyl = providerType === "PTERODACTYL";
  const isMailcow = providerType === "MAILCOW";
  const isPlesk = providerType === "PLESK";
  const usesMb = isPterodactyl;

  const fieldByKey = useMemo(() => new Map(orderFields.map((f) => [f.key, f])), [orderFields]);
  const has = (key: string) => orderFields.length === 0 || fieldByKey.has(key);

  const [locations, setLocations] = useState<ShopLocationOption[]>([]);
  const [templates, setTemplates] = useState<ShopTemplateOption[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [sshKeys, setSshKeys] = useState<Array<{ id: string; name: string; fingerprint: string }>>([]);
  const [sshKeysLoading, setSshKeysLoading] = useState(false);
  const [showEggDropdown, setShowEggDropdown] = useState(false);

  const eggs = (product.pterodactylEggs ?? []) as ShopPterodactylEgg[];
  const fixedEggId = product.pterodactylProductEggId;
  const fixedNestId = product.pterodactylProductNestId;
  const allowDockerImageSwitch = product.pterodactylAllowDockerImageSwitch === true;
  const selectedEgg =
    eggs.find((e) => e.eggId === (options.eggId ?? fixedEggId)) || eggs[0];
  const showEggSelector = isPterodactyl && has("egg") && eggs.length > 0 && !fixedEggId;
  const providerVariables = selectedEgg?.providerVariables ?? [];

  const allowedCycles = useMemo(() => filterAllowedBillingCycles(product), [product]);
  const billingOptions = useMemo(() => getBillingOptions(product), [product]);

  const baseVcores = numSpec(product.vcores, isPterodactyl ? 0 : 2);
  const baseMemory = numSpec(product.memory, isPterodactyl ? 0 : 4);
  const baseStorage = numSpec(product.storage, isPterodactyl ? 0 : 50);
  const rp = upgradeConfig?.resourcePricing;

  const maxVcores = Math.max(baseVcores, rp?.vcores?.max ?? baseVcores);
  const maxMemory = Math.max(baseMemory, rp?.memory?.max ?? baseMemory);
  const maxStorage = Math.max(baseStorage, rp?.storage?.max ?? baseStorage);
  const memoryStep = usesMb ? 1024 : 1;
  const storageStep = usesMb ? (rp?.storage?.step ?? 10240) : (rp?.storage?.step ?? 10);
  const memoryUnit = usesMb ? "MB" : "GB";
  const storageUnit = usesMb ? "MB" : "GB";

  const vcoresEditable = !isMailcow && !isPlesk && isResourceEditable(product, upgradeConfig, "vcores");
  const memoryEditable = !isMailcow && !isPlesk && isResourceEditable(product, upgradeConfig, "memory");
  const storageEditable = !isMailcow && !isPlesk && isResourceEditable(product, upgradeConfig, "storage");

  const canAddSshKey =
    !!(product.providerCapabilities as { canAddSshKey?: boolean } | undefined)?.canAddSshKey &&
    has("sshKeys");
  const maxIPv4 = Number(product.providerCapabilities?.maxIPv4 ?? 10);
  const maxIPv6 = Number(product.providerCapabilities?.maxIPv6 ?? 30);
  const hasIpSupport = (has("ipv4") || has("ipv6") || orderFields.length === 0) && (maxIPv4 > 0 || maxIPv6 > 0);

  const speedOptions = useMemo(() => {
    const base = Array.isArray(product.speedUpgradeOptions) ? product.speedUpgradeOptions : [];
    return [{ gbit: 0, priceGross: 0 }, ...base];
  }, [product.speedUpgradeOptions]);
  const maxTrafficAddonTb = Math.max(0, Math.floor(Number(product.maxTrafficAddonTb ?? 0) || 0));
  const showSpeedTraffic =
    isProxmox && !product.soldOut && (maxTrafficAddonTb > 0 || speedOptions.length > 1);
  const trafficMonthlyPrice = calculateTrafficAddonPrice(
    options.trafficAddonTb,
    product.trafficPricingBlocks,
  );
  const speedMonthlyPrice =
    speedOptions.find((o) => o.gbit === options.speedUpgradeGbit)?.priceGross ?? 0;

  const canUpgradeMailcow = upgradeConfig?.allowPrePurchaseUpgrade === true;
  const mailcowLimits = useMemo(() => {
    const domainsBase = product.maxDomains ?? 1;
    const mailboxesBase = product.maxMailboxesPerDomain ?? 5;
    const storageBase = product.storagePerMailboxGb ?? 1;
    const aliasesBase = product.maxAliasesPerDomain ?? 5;
    const lim = (
      key: "maxDomains" | "maxMailboxesPerDomain" | "storagePerMailboxGb" | "maxAliasesPerDomain",
      current: number,
      base: number,
    ) => {
      const pricing = rp?.[key];
      const editable = Boolean(canUpgradeMailcow && (pricing?.upgradePrice != null || pricing?.allowDowngrade));
      return {
        current,
        min: base,
        max: Math.max(base, pricing?.max ?? base),
        step: pricing?.step ?? 1,
        editable,
      };
    };
    return {
      maxDomains: lim("maxDomains", options.maxDomains ?? domainsBase, domainsBase),
      maxMailboxesPerDomain: lim(
        "maxMailboxesPerDomain",
        options.maxMailboxesPerDomain ?? mailboxesBase,
        mailboxesBase,
      ),
      storagePerMailboxGb: lim(
        "storagePerMailboxGb",
        options.storagePerMailboxGb ?? storageBase,
        storageBase,
      ),
      maxAliasesPerDomain: lim(
        "maxAliasesPerDomain",
        options.maxAliasesPerDomain ?? aliasesBase,
        aliasesBase,
      ),
    };
  }, [canUpgradeMailcow, options, product, rp]);

  const canUpgradePlesk = upgradeConfig?.allowPrePurchaseUpgrade === true;
  const basePleskStoragePerDomain =
    typeof product.storagePerDomainGb === "number" ? product.storagePerDomainGb : 5;
  const basePleskDns = typeof product.dnsManagement === "number" ? product.dnsManagement : -1;
  const basePleskMailboxes =
    typeof product.maxMailboxesPerDomain === "number" ? product.maxMailboxesPerDomain : -1;
  const basePleskStoragePerMailbox =
    typeof product.storagePerMailboxGb === "number" ? product.storagePerMailboxGb : -1;
  const showPleskMailLimits = basePleskMailboxes >= 0 || basePleskStoragePerMailbox >= 0;
  const showPleskDnsLimit = basePleskDns >= 0;

  const pleskLimits = useMemo(() => {
    const domainsBase = product.maxDomains ?? 1;
    const lim = (
      key:
        | "maxDomains"
        | "storagePerDomainGb"
        | "maxMailboxesPerDomain"
        | "storagePerMailboxGb"
        | "dnsManagement",
      current: number,
      base: number,
      opts?: { max?: number; forceEditable?: boolean },
    ) => {
      const pricing = rp?.[key];
      const editable = Boolean(
        (opts?.forceEditable ?? true) &&
          canUpgradePlesk &&
          (pricing?.upgradePrice != null || pricing?.allowDowngrade || (pricing?.max ?? 0) > base),
      );
      return {
        current,
        min: base,
        max: Math.max(base, opts?.max ?? pricing?.max ?? base),
        step: pricing?.step ?? 1,
        editable,
      };
    };
    return {
      maxDomains: lim("maxDomains", options.maxDomains ?? domainsBase, domainsBase),
      storagePerDomainGb: lim(
        "storagePerDomainGb",
        options.storagePerDomainGb ?? basePleskStoragePerDomain,
        basePleskStoragePerDomain,
      ),
      maxMailboxesPerDomain: lim(
        "maxMailboxesPerDomain",
        options.maxMailboxesPerDomain ?? Math.max(0, basePleskMailboxes),
        Math.max(0, basePleskMailboxes),
        { forceEditable: showPleskMailLimits },
      ),
      storagePerMailboxGb: lim(
        "storagePerMailboxGb",
        options.storagePerMailboxGb ?? Math.max(0, basePleskStoragePerMailbox),
        Math.max(0, basePleskStoragePerMailbox),
        { forceEditable: showPleskMailLimits },
      ),
      dnsManagement: lim(
        "dnsManagement",
        options.dnsManagement ?? Math.max(0, basePleskDns),
        Math.max(0, basePleskDns),
        { max: 1, forceEditable: showPleskDnsLimit && basePleskDns < 1 },
      ),
    };
  }, [
    canUpgradePlesk,
    options,
    product,
    rp,
    basePleskStoragePerDomain,
    basePleskMailboxes,
    basePleskStoragePerMailbox,
    basePleskDns,
    showPleskMailLimits,
    showPleskDnsLimit,
  ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingExtras(true);
      try {
        const [locRes, tplRes] = await Promise.all([
          has("location") || orderFields.length === 0
            ? api.shop.productLocations(product.id)
            : Promise.resolve(null),
          isProxmox && (has("template") || orderFields.length === 0)
            ? api.shop.productTemplates(product.id)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (locRes?.success) {
          const list = Array.isArray(locRes.locations) ? (locRes.locations as ShopLocationOption[]) : [];
          setLocations(list);
          if (list.length === 1 && !options.selectedLocationId) {
            onChange({ ...options, selectedLocationId: list[0]?.id });
          }
        }
        if (tplRes?.success && Array.isArray(tplRes.templates)) {
          const list = tplRes.templates as ShopTemplateOption[];
          setTemplates(list);
          if (list.length === 1 && options.selectedTemplateId == null) {
            onChange({ ...options, selectedTemplateId: list[0]?.templateId });
          }
        }
      } finally {
        if (!cancelled) setLoadingExtras(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, isProxmox]);

  useEffect(() => {
    if (!isPterodactyl || eggs.length === 0) return;
    if (options.eggId != null) return;
    const initial = fixedEggId
      ? eggs.find((e) => e.eggId === fixedEggId) || eggs[0]
      : eggs[0];
    if (!initial) return;
    onChange({
      ...options,
      eggId: initial.eggId,
      nestId: initial.nestId ?? fixedNestId,
      dockerImage: initial.defaultDockerImage || initial.dockerImages?.[0],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPterodactyl, eggs.length, fixedEggId]);

  useEffect(() => {
    if (!canAddSshKey || !user) {
      setSshKeys([]);
      return;
    }
    let cancelled = false;
    setSshKeysLoading(true);
    void api.sshKeys
      .list()
      .then((data) => {
        if (cancelled) return;
        const list = (data?.sshKeys ?? []) as Array<{
          id: string;
          name: string;
          fingerprint: string;
        }>;
        setSshKeys(list);
      })
      .catch(() => {
        if (!cancelled) setSshKeys([]);
      })
      .finally(() => {
        if (!cancelled) setSshKeysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAddSshKey, user]);

  const fmt = (value: number) => displayShopPrice(value, lang, isBusiness, businessPricing);
  const patch = (partial: Partial<ProductProviderOptions>) => onChange({ ...options, ...partial });

  const ipv6Unit =
    ipv6Pricing && typeof ipv6Pricing === "object"
      ? Object.values(ipv6Pricing)[0] ?? upgradeConfig?.additionalIPv6PricePerMonth ?? 0
      : upgradeConfig?.additionalIPv6PricePerMonth ?? 0;

  return (
    <div className="space-y-6">
      {(vcoresEditable || memoryEditable || storageEditable) && (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">
            {t("configuratorStepPerformanceTitle")}
          </h3>
          {vcoresEditable && (!isPterodactyl || baseVcores > 0) ? (
            <SpecStepper
              label="vCPU"
              value={options.vcores}
              unit=""
              min={baseVcores}
              max={maxVcores}
              step={1}
              onChange={(vcores) => {
                patch({ vcores });
                onUpgradeFieldEdited?.("vcores");
              }}
              invalid={!!invalidUpgradeFields?.vcores}
            />
          ) : null}
          {memoryEditable && (!isPterodactyl || baseMemory > 0) ? (
            <SpecStepper
              label="RAM"
              value={options.memory}
              unit={memoryUnit}
              min={baseMemory}
              max={maxMemory}
              step={memoryStep}
              onChange={(memory) => {
                patch({ memory });
                onUpgradeFieldEdited?.("memory");
              }}
              invalid={!!invalidUpgradeFields?.memory}
            />
          ) : null}
          {storageEditable && (!isPterodactyl || baseStorage > 0) ? (
            <SpecStepper
              label={t("shopStorage")}
              value={options.storage}
              unit={
                product.storageTypeDisplay
                  ? `${storageUnit} ${product.storageTypeDisplay}`
                  : storageUnit
              }
              min={baseStorage}
              max={maxStorage}
              step={storageStep}
              onChange={(storage) => {
                patch({ storage });
                onUpgradeFieldEdited?.("storage");
              }}
              invalid={!!invalidUpgradeFields?.storage}
            />
          ) : null}
        </section>
      )}

      {isMailcow ? (
        <section className="glass space-y-4 p-4">
          <div>
            <h3 className="text-sm font-semibold text-(--text-primary)">
              {t("mailcowProductPanelTitle")}
            </h3>
            <p className="mt-1 text-xs text-(--text-muted)">{t("mailcowProductPanelDesc")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  key: "maxDomains" as const,
                  limit: mailcowLimits.maxDomains,
                  label: t("mailcowLimitDomainsLabel"),
                  unit: "",
                },
                {
                  key: "maxMailboxesPerDomain" as const,
                  limit: mailcowLimits.maxMailboxesPerDomain,
                  label: t("mailcowLimitMailboxesPerDomainLabel"),
                  unit: "",
                },
                {
                  key: "storagePerMailboxGb" as const,
                  limit: mailcowLimits.storagePerMailboxGb,
                  label: t("mailcowLimitStoragePerMailboxLabel"),
                  unit: "GB",
                },
                {
                  key: "maxAliasesPerDomain" as const,
                  limit: mailcowLimits.maxAliasesPerDomain,
                  label: t("mailcowLimitAliasesPerDomainLabel"),
                  unit: "",
                },
              ] as const
            ).map(({ key, limit, label, unit }) =>
              limit.editable ? (
                <SpecStepper
                  key={key}
                  label={label}
                  value={limit.current}
                  unit={unit}
                  min={limit.min}
                  max={limit.max}
                  step={limit.step}
                  onChange={(value) => {
                    patch({ [key]: value });
                    onUpgradeFieldEdited?.(key);
                  }}
                  invalid={!!invalidUpgradeFields?.[key]}
                />
              ) : (
                <div key={key} className="rounded-xl border border-(--border) bg-(--bg-elevated) p-3">
                  <p className="text-xs text-(--text-muted)">{label}</p>
                  <p className="text-sm font-semibold text-(--text-primary)">
                    {limit.current}
                    {unit ? ` ${unit}` : ""}
                  </p>
                </div>
              ),
            )}
          </div>
          <p className="text-xs text-(--text-muted)">
            {t("mailcowProductPanelAllocationSummary")
              .replace("{domains}", String(mailcowLimits.maxDomains.current))
              .replace(
                "{domainsWord}",
                mailcowLimits.maxDomains.current === 1
                  ? t("mailcowWordDomainSingular")
                  : t("mailcowWordDomainPlural"),
              )
              .replace("{mailboxes}", String(mailcowLimits.maxMailboxesPerDomain.current))
              .replace(
                "{mailboxesWord}",
                mailcowLimits.maxMailboxesPerDomain.current === 1
                  ? t("mailcowWordMailboxSingular")
                  : t("mailcowWordMailboxPlural"),
              )
              .replace("{storage}", String(mailcowLimits.storagePerMailboxGb.current))
              .replace("{aliases}", String(mailcowLimits.maxAliasesPerDomain.current))
              .replace(
                "{aliasesWord}",
                mailcowLimits.maxAliasesPerDomain.current === 1
                  ? t("mailcowWordAliasSingular")
                  : t("mailcowWordAliasPlural"),
              )}
          </p>
        </section>
      ) : null}

      {isPlesk ? (
        <section className="glass space-y-4 p-4">
          <div>
            <h3 className="text-sm font-semibold text-(--text-primary)">{t("pleskShopTitle")}</h3>
            <p className="mt-1 text-xs text-(--text-muted)">{t("pleskShopDesc")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  key: "maxDomains" as const,
                  limit: pleskLimits.maxDomains,
                  label: t("pleskLimitDomainsLabel"),
                  unit: "",
                },
                {
                  key: "storagePerDomainGb" as const,
                  limit: pleskLimits.storagePerDomainGb,
                  label: t("pleskLimitStoragePerDomainLabel"),
                  unit: "GB",
                },
                ...(showPleskMailLimits
                  ? ([
                      {
                        key: "maxMailboxesPerDomain" as const,
                        limit: pleskLimits.maxMailboxesPerDomain,
                        label: t("pleskLimitMailboxesPerDomainLabel"),
                        unit: "",
                      },
                      {
                        key: "storagePerMailboxGb" as const,
                        limit: pleskLimits.storagePerMailboxGb,
                        label: t("pleskLimitStoragePerMailboxLabel"),
                        unit: "GB",
                      },
                    ] as const)
                  : []),
                ...(showPleskDnsLimit
                  ? ([
                      {
                        key: "dnsManagement" as const,
                        limit: pleskLimits.dnsManagement,
                        label: t("pleskLimitDnsLabel"),
                        unit: "",
                      },
                    ] as const)
                  : []),
              ] as const
            ).map(({ key, limit, label, unit }) =>
              limit.editable ? (
                <SpecStepper
                  key={key}
                  label={label}
                  value={limit.current}
                  unit={unit}
                  min={limit.min}
                  max={limit.max}
                  step={limit.step}
                  onChange={(value) => {
                    patch({ [key]: value });
                    onUpgradeFieldEdited?.(key);
                  }}
                  invalid={!!invalidUpgradeFields?.[key]}
                />
              ) : (
                <div key={key} className="rounded-xl border border-(--border) bg-(--bg-elevated) p-3">
                  <p className="text-xs text-(--text-muted)">{label}</p>
                  <p className="text-sm font-semibold text-(--text-primary)">
                    {key === "dnsManagement"
                      ? limit.current >= 1
                        ? t("pleskDnsEnabledShort")
                        : t("pleskDnsDisabledShort")
                      : `${limit.current}${unit ? ` ${unit}` : ""}`}
                  </p>
                </div>
              ),
            )}
          </div>
          <p className="text-xs text-(--text-muted)">
            {(() => {
              let text = t("pleskProductPanelAllocationSummary")
                .replace("{domains}", String(pleskLimits.maxDomains.current))
                .replace(
                  "{domainsWord}",
                  pleskLimits.maxDomains.current === 1
                    ? t("pleskWordDomainSingular")
                    : t("pleskWordDomainPlural"),
                )
                .replace("{storage}", String(pleskLimits.storagePerDomainGb.current));
              if (showPleskMailLimits) {
                text +=
                  " " +
                  t("pleskProductPanelMailSummary")
                    .replace("{mailboxes}", String(pleskLimits.maxMailboxesPerDomain.current))
                    .replace(
                      "{mailboxesWord}",
                      pleskLimits.maxMailboxesPerDomain.current === 1
                        ? t("pleskWordMailboxSingular")
                        : t("pleskWordMailboxPlural"),
                    )
                    .replace("{mailboxStorage}", String(pleskLimits.storagePerMailboxGb.current));
              }
              if (showPleskDnsLimit) {
                text +=
                  " " +
                  (pleskLimits.dnsManagement.current >= 1
                    ? t("pleskProductPanelDnsEnabled")
                    : t("pleskProductPanelDnsDisabled"));
              }
              return text;
            })()}
          </p>
        </section>
      ) : null}

      {showSpeedTraffic ? (
        <section className="glass space-y-4 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">
            {t("configuratorStepNetworkUpgradesTitle")}
          </h3>
          {speedOptions.length > 1 ? (
            <div className="space-y-2">
              <label className="text-xs text-(--text-muted)">{t("providerOrderPortSpeed")}</label>
              <select
                value={options.speedUpgradeGbit}
                onChange={(e) => patch({ speedUpgradeGbit: Number(e.target.value) })}
                className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-3 py-2.5 text-sm"
              >
                {speedOptions.map((row) => (
                  <option key={row.gbit} value={row.gbit}>
                    {row.gbit === 0
                      ? t("configuratorMinNetworkSpeedAny")
                      : `${row.gbit} Gbit/s (+${fmt(row.priceGross)})`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {maxTrafficAddonTb > 0 ? (
            <SpecStepper
              label={t("configuratorTrafficAddonLabel")}
              value={options.trafficAddonTb}
              unit="TB"
              min={0}
              max={maxTrafficAddonTb}
              step={1}
              onChange={(trafficAddonTb) => patch({ trafficAddonTb })}
            />
          ) : null}
          {speedMonthlyPrice + trafficMonthlyPrice > 0 ? (
            <p className="text-xs text-(--text-muted)">
              {t("providerOrderAddonCost")}: +
              {fmt(
                computePeriodPrice(
                  speedMonthlyPrice + trafficMonthlyPrice,
                  billingCycle,
                  billingOptions,
                ),
              )}{" "}
              / {billingCycle} {t("days")}
            </p>
          ) : null}
        </section>
      ) : null}

      {showEggSelector ? (
        <section className="glass space-y-3 p-4">
          <label className="text-sm font-medium text-(--text-primary)">{t("selectServerType")}</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEggDropdown((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-(--border) bg-(--bg-elevated) px-4 py-3 text-left text-sm"
            >
              <span>{selectedEgg?.displayName || selectedEgg?.name || t("selectServerType")}</span>
              <span className={showEggDropdown ? "rotate-180" : ""}>▼</span>
            </button>
            {showEggDropdown ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-(--border) bg-(--bg-elevated) shadow-lg">
                {eggs.map((egg) => (
                  <button
                    key={egg.eggId}
                    type="button"
                    onClick={() => {
                      patch({
                        eggId: egg.eggId,
                        nestId: egg.nestId,
                        dockerImage: egg.defaultDockerImage || egg.dockerImages?.[0],
                        environment: {},
                        providerVariables: {},
                      });
                      setShowEggDropdown(false);
                    }}
                    className={`w-full border-b border-(--border) px-4 py-3 text-left last:border-b-0 ${
                      options.eggId === egg.eggId ? "bg-(--elizon-primary)/15" : ""
                    }`}
                  >
                    <div className="text-sm font-medium text-(--text-primary)">
                      {egg.displayName || egg.name}
                    </div>
                    {egg.description ? (
                      <div className="mt-1 text-xs text-(--text-muted)">{egg.description}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {selectedEgg ? (
            <EggEnvironmentFields
              egg={selectedEgg}
              environmentValues={options.environment ?? {}}
              onEnvironmentChange={(key, value) =>
                patch({ environment: { ...(options.environment ?? {}), [key]: value } })
              }
            />
          ) : null}
        </section>
      ) : null}

      {isPterodactyl && fixedEggId && selectedEgg ? (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">{t("selectServerType")}</h3>
          <p className="text-sm text-(--text-secondary)">
            {selectedEgg.displayName || selectedEgg.name}
          </p>
          <EggEnvironmentFields
            egg={selectedEgg}
            environmentValues={options.environment ?? {}}
            onEnvironmentChange={(key, value) =>
              patch({ environment: { ...(options.environment ?? {}), [key]: value } })
            }
            editableOnly={false}
          />
        </section>
      ) : null}

      {isPterodactyl &&
      allowDockerImageSwitch &&
      selectedEgg &&
      (selectedEgg.dockerImages?.length ?? 0) > 1 ? (
        <section className="glass space-y-3 p-4">
          <label className="text-sm font-medium text-(--text-primary)">{t("selectDockerImage")}</label>
          <div className="flex flex-wrap gap-2">
            {selectedEgg.dockerImages!.map((image) => (
              <button
                key={image}
                type="button"
                onClick={() => patch({ dockerImage: image })}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  options.dockerImage === image
                    ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--elizon-primary)"
                    : "border-(--border) text-(--text-secondary)"
                }`}
              >
                {formatDockerImageName(image)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isPterodactyl && providerVariables.length > 0 ? (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">{t("serverConfiguration")}</h3>
          <ProviderVariableFields
            variables={providerVariables}
            values={options.providerVariables ?? {}}
            onChange={(name, value) =>
              patch({
                providerVariables: { ...(options.providerVariables ?? {}), [name]: value },
              })
            }
          />
        </section>
      ) : null}

      {loadingExtras ? (
        <div className="flex items-center gap-2 text-sm text-(--text-muted)">
          <Loader2 className="size-4 animate-spin" />
          {t("loading")}
        </div>
      ) : null}

      {!loadingExtras && locations.length > 0 && (has("location") || orderFields.length === 0) ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">
            {t("configuratorLocationLabel")}
          </label>
          {locations.length === 1 && locations[0] ? (
            <p className="text-sm text-(--text-primary)">
              {locations[0].name}
              {locations[0].city ? ` · ${locations[0].city}` : ""}
            </p>
          ) : (
            <select
              value={options.selectedLocationId ?? ""}
              onChange={(e) => patch({ selectedLocationId: e.target.value || undefined })}
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
          )}
        </section>
      ) : null}

      {!loadingExtras && templates.length > 0 && (has("template") || orderFields.length === 0) ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">
            {t("configuratorOsTemplateLabel")}
          </label>
          {templates.length === 1 && templates[0] ? (
            <p className="text-sm text-(--text-primary)">
              {templates[0].displayName || templates[0].name}
            </p>
          ) : (
            <select
              value={options.selectedTemplateId ?? ""}
              onChange={(e) =>
                patch({
                  selectedTemplateId: e.target.value ? Number(e.target.value) : undefined,
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
          )}
        </section>
      ) : null}

      {canAddSshKey && !product.soldOut ? (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">{t("sshKeysSelectForOrder")}</h3>
          {!user ? (
            <p className="text-sm text-(--text-muted)">{t("sshKeysLoginRequired")}</p>
          ) : sshKeysLoading ? (
            <p className="text-sm text-(--text-muted)">{t("loading")}</p>
          ) : sshKeys.length === 0 ? (
            <p className="text-sm text-(--text-muted)">
              {t("sshKeysNoneAvailable")}{" "}
              <button
                type="button"
                className="text-(--elizon-primary) underline"
                onClick={() => navigate({ name: "ssh-keys" })}
              >
                {t("sshKeysAdd")}
              </button>
            </p>
          ) : (
            <div className="space-y-2">
              {sshKeys.map((key) => (
                <label key={key.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={options.sshKeyIds.includes(key.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...options.sshKeyIds, key.id]
                        : options.sshKeyIds.filter((id) => id !== key.id);
                      patch({ sshKeyIds: next });
                    }}
                  />
                  <span className="text-(--text-primary)">{key.name}</span>
                  <span className="truncate font-mono text-xs text-(--text-muted)">
                    {key.fingerprint}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {isProxmox && hasIpSupport && !product.soldOut ? (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-medium text-(--text-primary)">
            {t("configuratorStepAccessTitle")}
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.includeIPv4}
              onChange={(e) => {
                if (!e.target.checked && !options.includeIPv6) return;
                patch({
                  includeIPv4: e.target.checked,
                  additionalIPv4: e.target.checked ? options.additionalIPv4 : 0,
                });
              }}
            />
            IPv4
            {(upgradeConfig?.ipv4OptOutDiscount ?? 0) > 0 && !options.includeIPv4 ? (
              <span className="text-xs text-(--success)">
                −{fmt(upgradeConfig!.ipv4OptOutDiscount!)}
              </span>
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.includeIPv6}
              onChange={(e) => {
                if (!e.target.checked && !options.includeIPv4) return;
                patch({
                  includeIPv6: e.target.checked,
                  additionalIPv6: e.target.checked ? options.additionalIPv6 : 0,
                });
              }}
            />
            IPv6
          </label>
          {(upgradeConfig?.additionalIpsPricePerMonth ?? 0) > 0 ? (
            <SpecStepper
              label={`${t("configuratorAdditionalIpv4")}${
                upgradeConfig?.additionalIpsPricePerMonth
                  ? ` (+${fmt(upgradeConfig.additionalIpsPricePerMonth)})`
                  : ""
              }`}
              value={options.additionalIPv4}
              unit=""
              min={0}
              max={Math.max(0, maxIPv4 - 1)}
              step={1}
              onChange={(additionalIPv4) => patch({ additionalIPv4 })}
              disabled={!options.includeIPv4}
            />
          ) : null}
          {maxIPv6 > 0 ? (
            <SpecStepper
              label={`${t("configuratorAdditionalIpv6")}${
                ipv6Unit ? ` (+${fmt(Number(ipv6Unit))})` : ""
              }`}
              value={options.additionalIPv6}
              unit=""
              min={0}
              max={maxIPv6}
              step={1}
              onChange={(additionalIPv6) => patch({ additionalIPv6 })}
              disabled={!options.includeIPv6}
            />
          ) : null}
        </section>
      ) : null}

      {!hideBillingCycle ? (
        <section className="glass space-y-2 p-4">
          <label className="text-sm font-medium text-(--text-primary)">
            {t("productBillingInterval")}
          </label>
          <select
            value={billingCycle}
            onChange={(e) => onBillingCycleChange(Number(e.target.value))}
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
