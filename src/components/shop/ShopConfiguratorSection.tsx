import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";

import { useAuth } from "../AuthProvider";
import { useCart } from "../cart/CartProvider";
import { useRouter } from "../Router";
import { useToast } from "../Toast";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import {
  buildConfiguredCartItem,
  buildCustomizationPayload,
  validateConfiguredNewItem,
} from "../../lib/cart-configured";
import { computeConfiguratorCostBreakdown } from "../../lib/configurator-cost-breakdown";
import {
  filterAllowedBillingCycles,
  getBillingOptions,
  computeIpPriceMonthly,
  computeIpv4OptOutDiscount,
  computeBasePriceMonthly,
} from "../../lib/product-pricing";
import { computePeriodPrice } from "../../lib/billing";
import {
  findConfiguratorUpsellOffer,
  formatPortSpeed,
  getAvailableNetworkTiers,
  pickBaseProduct,
  type ConfiguratorTargetSpecs,
} from "../../lib/category-configurator";
import type { ShopCategory } from "../../lib/shop-catalog";
import {
  numSpec,
  type ConfiguratorProviderOptions,
  type ShopLocationOption,
  type ShopProductDetail,
  type ShopPterodactylEgg,
  type ShopTemplateOption,
  type ShopUpgradeConfig,
  usesMbResources,
} from "../../lib/shop-product-detail";
import { displayShopPrice, vatLabelFromContext, type CardPricing } from "../../features/shop/shop-pricing";
import { FairUseAcceptLabel, useFairUseAcceptCopy } from "../../components/ui/fair-use-accept-label";
import { EggEnvironmentFields } from "./egg-environment-fields";
import { ProviderVariableFields } from "./provider-variable-fields";
import { SpecStepper, WizardNav, WizardOption } from "./wizard-shell";

type ConfiguratorStep = "filter" | "performance" | "networkUpgrades" | "system" | "access" | "checkout";

type ShopConfiguratorSectionProps = {
  category: ShopCategory;
  pricing: CardPricing;
  className?: string;
};

function getEffectiveBases(products: ShopProductDetail[], minNetworkMBs: number) {
  const eligible = products.filter((product) => {
    if (product.soldOut) return false;
    if (minNetworkMBs <= 0) return true;
    const speed = Number(product.networkLimitMBs ?? 0);
    return Number.isFinite(speed) && speed >= minNetworkMBs;
  });
  if (eligible.length === 0) return { vcores: 1, memory: 1, storage: 1 };
  return {
    vcores: Math.min(...eligible.map((p) => numSpec(p.vcores, Number.POSITIVE_INFINITY))),
    memory: Math.min(...eligible.map((p) => numSpec(p.memory, Number.POSITIVE_INFINITY))),
    storage: Math.min(...eligible.map((p) => numSpec(p.storage, Number.POSITIVE_INFINITY))),
  };
}

function getSpecLimits(products: ShopProductDetail[], upgradeConfig: ShopUpgradeConfig | null, minNetworkMBs: number) {
  const eligible = products.filter((product) => {
    if (product.soldOut) return false;
    if (minNetworkMBs <= 0) return true;
    const speed = Number(product.networkLimitMBs ?? 0);
    return Number.isFinite(speed) && speed >= minNetworkMBs;
  });
  const rp = upgradeConfig?.resourcePricing;
  const maxFromProducts = {
    vcores: Math.max(...eligible.map((p) => numSpec(p.vcores, 0)), 0),
    memory: Math.max(...eligible.map((p) => numSpec(p.memory, 0)), 0),
    storage: Math.max(...eligible.map((p) => numSpec(p.storage, 0)), 0),
  };
  return {
    vcores: Math.max(maxFromProducts.vcores, rp?.vcores?.max ?? maxFromProducts.vcores),
    memory: Math.max(maxFromProducts.memory, rp?.memory?.max ?? maxFromProducts.memory),
    storage: Math.max(maxFromProducts.storage, rp?.storage?.max ?? maxFromProducts.storage),
  };
}

export function ShopConfiguratorSection({ category, pricing, className = "" }: ShopConfiguratorSectionProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { show } = useToast();
  const { addItem } = useCart();
  const { navigate } = useRouter();
  const fairUseCopy = useFairUseAcceptCopy();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProductDetail[]>([]);
  const [upgradeConfig, setUpgradeConfig] = useState<ShopUpgradeConfig | null>(null);
  const [locations, setLocations] = useState<ShopLocationOption[]>([]);
  const [templates, setTemplates] = useState<ShopTemplateOption[]>([]);
  const [ipv6Pricing, setIpv6Pricing] = useState<Record<string, number> | null>(null);
  const [sshKeys, setSshKeys] = useState<Array<{ id: string; name: string; fingerprint: string }>>([]);
  const [sshKeysLoading, setSshKeysLoading] = useState(false);
  const [options, setOptions] = useState<ConfiguratorProviderOptions | null>(null);
  const [step, setStep] = useState<ConfiguratorStep>("performance");
  const [adding, setAdding] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [fairUseAccepted, setFairUseAccepted] = useState(false);
  const [upsellDismissedKey, setUpsellDismissedKey] = useState<string | null>(null);

  const providerType = category.provider?.type?.toUpperCase() ?? "";
  const usesMb = usesMbResources(category.provider?.type);
  const networkTiers = useMemo(() => getAvailableNetworkTiers(products), [products]);
  const fmt = (value: number | string) => displayShopPrice(value, lang, pricing.priceContext);
  const vat = vatLabelFromContext(pricing.priceContext, lang);

  const steps = useMemo<ConfiguratorStep[]>(() => {
    const list: ConfiguratorStep[] = [];
    if (networkTiers.length > 1) list.push("filter");
    if (providerType !== "PLOI" && providerType !== "MAILCOW" && providerType !== "PLESK") list.push("performance");
    if (providerType === "PROXMOX") list.push("networkUpgrades");
    if (providerType === "PTERODACTYL" || providerType === "PROXMOX") list.push("system");
    list.push("access", "checkout");
    return list;
  }, [networkTiers.length, providerType]);

  const stepIndex = Math.max(0, steps.indexOf(step));

  useEffect(() => {
    let cancelled = false;
    void api.shop.publicSettings().then((data) => {
      if (cancelled || !data?.settings) return;
      const pricingSettings = data.settings["ipv6.subnet_pricing"];
      if (pricingSettings && typeof pricingSettings === "object") {
        setIpv6Pricing(pricingSettings as Record<string, number>);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const slugs = category.products.map((p) => p.slug).filter(Boolean);
        const categoryId = category.id ?? category.key;
        const [upgradeRes, ...productRows] = await Promise.all([
          api.shop.upgradeConfig(categoryId),
          ...slugs.map((slug) => api.shop.productDetail(category.key, slug, lang)),
        ]);
        if (cancelled) return;
        const detailed = productRows
          .map((row) => (row?.success && row.product ? row.product : null))
          .filter((row): row is ShopProductDetail => row != null && !row.soldOut);
        setProducts(detailed);
        setUpgradeConfig(upgradeRes?.success ? (upgradeRes.config ?? null) : null);
        const bases = getEffectiveBases(detailed, 0);
        setOptions({
          vcores: bases.vcores,
          memory: bases.memory,
          storage: bases.storage,
          minNetworkMBs: 0,
          billingCycle: 30,
          additionalIPv4: 0,
          additionalIPv6: 0,
          includeIPv4: true,
          includeIPv6: true,
          sshKeyIds: [],
          trafficAddonTb: 0,
          speedUpgradeGbit: 0,
          environment: {},
          providerVariables: {},
          maxDomains: detailed[0]?.maxDomains,
          storagePerDomainGb:
            typeof detailed[0]?.storagePerDomainGb === "number"
              ? detailed[0].storagePerDomainGb
              : providerType === "PLESK"
                ? 5
                : undefined,
          maxMailboxesPerDomain: detailed[0]?.maxMailboxesPerDomain,
          storagePerMailboxGb: detailed[0]?.storagePerMailboxGb,
          dnsManagement:
            typeof detailed[0]?.dnsManagement === "number"
              ? Math.max(0, detailed[0].dnsManagement)
              : undefined,
        });
        const nextSteps: ConfiguratorStep[] = [];
        if (getAvailableNetworkTiers(detailed).length > 1) nextSteps.push("filter");
        if (providerType !== "PLOI" && providerType !== "MAILCOW" && providerType !== "PLESK") {
          nextSteps.push("performance");
        }
        if (providerType === "PROXMOX") nextSteps.push("networkUpgrades");
        if (providerType === "PTERODACTYL" || providerType === "PROXMOX") nextSteps.push("system");
        nextSteps.push("access", "checkout");
        setStep(nextSteps[0] ?? "access");
      } catch (err) {
        if (!cancelled) setError(resolveCaughtApiError(err, t));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, lang, t]);

  const minNetworkMBs = options?.minNetworkMBs ?? 0;
  const effectiveBases = useMemo(() => getEffectiveBases(products, minNetworkMBs), [products, minNetworkMBs]);
  const specLimits = useMemo(() => getSpecLimits(products, upgradeConfig, minNetworkMBs), [products, upgradeConfig, minNetworkMBs]);

  const target: ConfiguratorTargetSpecs | null = options
    ? { vcores: options.vcores, memory: options.memory, storage: options.storage, minNetworkMBs: options.minNetworkMBs }
    : null;

  const picked = useMemo(() => {
    if (!target || products.length === 0) return null;
    return pickBaseProduct(products, target, upgradeConfig, usesMb);
  }, [products, target, upgradeConfig, usesMb]);

  const activeProduct = picked?.product as ShopProductDetail | undefined;
  const billingOptions = activeProduct ? getBillingOptions(activeProduct) : { billingDiscountPerMonth: 0, billingSurcharge7d: 0, billingSurcharge14d: 0 };
  const allowedBillingCycles = activeProduct ? filterAllowedBillingCycles(activeProduct) : [30];
  const billingCycle = options?.billingCycle ?? 30;

  const basePriceMonthly = useMemo(() => {
    if (!activeProduct || !options) return 0;
    return computeBasePriceMonthly(activeProduct, options, upgradeConfig, usesMb);
  }, [activeProduct, options, upgradeConfig, usesMb]);

  const ipPriceMonthly = useMemo(() => {
    if (!activeProduct || !options) return 0;
    return computeIpPriceMonthly(activeProduct, options, upgradeConfig, ipv6Pricing);
  }, [activeProduct, options, upgradeConfig, ipv6Pricing]);

  const ipv4OptOutDiscount = useMemo(() => {
    if (!activeProduct || !options) return 0;
    return computeIpv4OptOutDiscount(activeProduct, options, upgradeConfig);
  }, [activeProduct, options, upgradeConfig]);

  const periodPrice = useMemo(() => {
    const monthly = Math.max(0, basePriceMonthly + ipPriceMonthly - ipv4OptOutDiscount);
    return Math.max(
      0,
      computePeriodPrice(basePriceMonthly, billingCycle, billingOptions) +
        computePeriodPrice(ipPriceMonthly, billingCycle, billingOptions) -
        computePeriodPrice(ipv4OptOutDiscount, billingCycle, billingOptions),
    );
  }, [basePriceMonthly, ipPriceMonthly, ipv4OptOutDiscount, billingCycle, billingOptions]);

  const upsellKey = target ? JSON.stringify(target) : "";
  const upsellOffer = useMemo(() => {
    if (!picked || !target || upsellDismissedKey === upsellKey) return null;
    return findConfiguratorUpsellOffer(picked, products, target, upgradeConfig, usesMb);
  }, [picked, products, target, upgradeConfig, usesMb, upsellDismissedKey, upsellKey]);

  const costBreakdown = useMemo(() => {
    if (!activeProduct || !options) return [];
    return computeConfiguratorCostBreakdown({
      activeProduct,
      options,
      upgradeConfig,
      usesMb,
      billingCycle,
      billingOptions,
      basePriceMonthly,
      ipPriceMonthly,
      ipv4OptOutDiscount,
      ipv6UnitPrice: 0,
      t,
    });
  }, [activeProduct, options, upgradeConfig, usesMb, billingCycle, billingOptions, basePriceMonthly, ipPriceMonthly, ipv4OptOutDiscount, t]);

  const selectedEgg = useMemo((): ShopPterodactylEgg | undefined => {
    if (!activeProduct?.pterodactylEggs?.length || options?.eggId == null) return undefined;
    return activeProduct.pterodactylEggs.find((egg) => egg.eggId === options.eggId);
  }, [activeProduct, options?.eggId]);

  useEffect(() => {
    if (!activeProduct?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [locRes, tplRes] = await Promise.all([
          api.shop.productLocations(activeProduct.id),
          providerType === "PROXMOX" ? api.shop.productTemplates(activeProduct.id) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (locRes?.success) {
          const list = Array.isArray(locRes.locations) ? locRes.locations : [];
          setLocations(list);
          if (list.length === 1) {
            setOptions((prev) => (prev ? { ...prev, selectedLocationId: list[0]?.id } : prev));
          }
        }
        if (tplRes?.success && Array.isArray(tplRes.templates)) setTemplates(tplRes.templates);
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProduct?.id, providerType]);

  const stepMeta = useMemo(() => {
    switch (step) {
      case "filter":
        return { title: t("configuratorStepFilterTitle"), description: t("configuratorStepFilterDescription") };
      case "performance":
        return { title: t("configuratorStepPerformanceTitle"), description: t("configuratorStepPerformanceDescription") };
      case "networkUpgrades":
        return { title: t("configuratorStepNetworkUpgradesTitle"), description: t("configuratorStepNetworkUpgradesDescription") };
      case "system":
        return { title: t("configuratorStepSystemTitle"), description: t("configuratorStepSystemDescription") };
      case "access":
        return { title: t("configuratorStepAccessTitle"), description: t("configuratorStepAccessDescription") };
      default:
        return { title: t("configuratorStepCheckoutTitle"), description: t("configuratorStepCheckoutDescription") };
    }
  }, [step, t]);

  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const canAddSshKey = Boolean(
    (activeProduct?.providerCapabilities as { canAddSshKey?: boolean } | null | undefined)?.canAddSshKey,
  );
  const hasIpSupport = providerType === "PROXMOX";
  const maxIPv4 = Number(activeProduct?.providerCapabilities?.maxIPv4 ?? 5);
  const maxIPv6 = Number(activeProduct?.providerCapabilities?.maxIPv6 ?? 3);
  const ipv6Unit =
    ipv6Pricing && Object.keys(ipv6Pricing).length > 0
      ? Number(Object.values(ipv6Pricing)[0] ?? 0)
      : 0;

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
          fingerprint?: string;
        }>;
        setSshKeys(
          list.map((key) => ({
            id: key.id,
            name: key.name,
            fingerprint: key.fingerprint ?? "",
          })),
        );
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

  const addConfigured = async (goToCheckout: boolean) => {
    if (!options || !activeProduct || picked == null || !fairUseAccepted) return;
    if (locations.length > 0 && !options.selectedLocationId) {
      show(t("configuratorLocationRequired"), "error");
      return;
    }
    if (hasIpSupport && !options.includeIPv4 && !options.includeIPv6) {
      show(t("productIpTypeRequired"), "error");
      return;
    }
    setAdding(true);
    setCheckingAvailability(true);
    try {
      const configured = buildCustomizationPayload(activeProduct, options, usesMb, upgradeConfig);
      const validation = await validateConfiguredNewItem(activeProduct, configured.customization);
      if (validation.unavailable) {
        show(t("productConfigurationUnavailable"), "error");
        return;
      }
      if (!validation.ok) {
        show(t("checkoutError"), "warning");
      }
      addItem(
        buildConfiguredCartItem({
          product: activeProduct,
          options,
          priceMonthly: picked.totalMonthly,
          categoryId: category.id ?? category.key,
          categoryName: category.name,
          usesMb,
          upgradeConfig,
          billingCycle: options.billingCycle,
        }),
      );
      show(t("productAddedToCart"), "success");
      if (goToCheckout) navigate({ name: "checkout" });
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setCheckingAvailability(false);
      setAdding(false);
    }
  };

  const acceptUpsell = () => {
    if (!upsellOffer || !options) return;
    const product = upsellOffer.product as ShopProductDetail;
    setOptions({
      ...options,
      vcores: numSpec(product.vcores, options.vcores),
      memory: numSpec(product.memory, options.memory),
      storage: numSpec(product.storage, options.storage),
    });
    setUpsellDismissedKey(upsellKey);
  };

  if (category.products.length === 0) return null;

  return (
    <section
      className={`col-span-full rounded-[var(--radius-surface)] border border-(--border) bg-(--bg-elevated) p-6 ${className}`}
      aria-labelledby="category-configurator-title"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-(--text-muted)">{t("categoryPill")}</p>
          <h2 id="category-configurator-title" className="text-xl font-semibold text-(--text-primary)">
            {t("configuratorTitle")}
          </h2>
          <p className="text-sm text-(--text-secondary)">{t("configuratorSubtitle")}</p>
        </div>
        <div className="w-full shrink-0 rounded-xl border border-(--border) bg-(--bg-base) p-4 lg:w-72">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-(--elizon-primary)" />
          ) : activeProduct && picked ? (
            <>
              <p className="text-xs text-(--text-muted)">{t("configuratorRecommendedPlan")}</p>
              <p className="mt-1 truncate text-lg font-semibold text-(--text-primary)">{activeProduct.name}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-(--elizon-primary)">{fmt(periodPrice)}</p>
              <p className="text-xs text-(--text-muted)">
                / {billingCycle} {t("days")} · {vat}
              </p>
            </>
          ) : (
            <p className="text-sm text-(--warning)">{t("configuratorNoMatchingPlan")}</p>
          )}
        </div>
      </div>

      {upsellOffer ? (
        <div className="mt-6 rounded-xl border border-(--primary)/30 bg-(--primary)/5 p-4">
          <p className="text-sm font-semibold text-(--text-primary)">{t("configuratorUpsellTitle")}</p>
          <p className="mt-1 text-sm text-(--text-secondary)">
            {t("configuratorUpsellBody")
              .replace("{name}", upsellOffer.product.name ?? "")
              .replace(
                "{details}",
                [
                  upsellOffer.bonuses.vcores
                    ? t("configuratorUpsellBonusVcores").replace("{n}", String(upsellOffer.bonuses.vcores))
                    : null,
                  upsellOffer.bonuses.memory
                    ? t("configuratorUpsellBonusMemory").replace("{n}", String(upsellOffer.bonuses.memory))
                    : null,
                  upsellOffer.bonuses.storage
                    ? t("configuratorUpsellBonusStorage").replace("{n}", String(upsellOffer.bonuses.storage))
                    : null,
                ]
                  .filter(Boolean)
                  .join(", "),
              )
              .replace("{delta}", fmt(upsellOffer.deltaMonthly))}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={acceptUpsell} className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold">
              {t("configuratorUpsellAccept")}
            </button>
            <button
              type="button"
              onClick={() => setUpsellDismissedKey(upsellKey)}
              className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
            >
              {t("configuratorUpsellDismiss")}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-(--elizon-primary)" />
        </div>
      ) : error ? (
        <p className="mt-8 text-sm text-(--error)">{error}</p>
      ) : !options ? (
        <p className="mt-8 text-sm text-(--text-secondary)">{t("configuratorNoMatchingPlan")}</p>
      ) : (
        <div className="mt-8 space-y-6">
          <nav aria-label={t("configuratorWizardNavAria")} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--border)">
                <div
                  className="h-full rounded-full bg-(--elizon-primary) transition-all duration-300"
                  style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-(--text-muted)">
                {t("configuratorWizardProgress")
                  .replace("{current}", String(stepIndex + 1))
                  .replace("{total}", String(steps.length))}
              </span>
            </div>
          </nav>

          <div className="rounded-xl border border-(--border) bg-(--bg-base) px-4 py-3">
            <h3 className="text-base font-semibold text-(--text-primary)">{stepMeta.title}</h3>
            <p className="mt-1 text-sm text-(--text-secondary)">{stepMeta.description}</p>
          </div>

          {step === "filter" ? (
            <div className="grid gap-2">
              <WizardOption
                label={t("configuratorMinNetworkSpeedAny")}
                selected={minNetworkMBs === 0}
                onSelect={() => setOptions((prev) => (prev ? { ...prev, minNetworkMBs: 0 } : prev))}
              />
              {networkTiers.map((tier) => (
                <WizardOption
                  key={tier}
                  label={t("configuratorMinSpeedChipAtLeast").replace("{speed}", formatPortSpeed(tier))}
                  selected={minNetworkMBs === tier}
                  onSelect={() => {
                    const bases = getEffectiveBases(products, tier);
                    setOptions((prev) =>
                      prev ? { ...prev, minNetworkMBs: tier, vcores: bases.vcores, memory: bases.memory, storage: bases.storage } : prev,
                    );
                  }}
                />
              ))}
            </div>
          ) : null}

          {step === "performance" ? (
            <div className="space-y-3">
              <SpecStepper label="vCPU" value={options.vcores} unit="" min={effectiveBases.vcores} max={Math.max(specLimits.vcores, effectiveBases.vcores)} step={1} onChange={(vcores) => setOptions((prev) => (prev ? { ...prev, vcores } : prev))} />
              <SpecStepper label="RAM" value={options.memory} unit={usesMb ? "MB" : "GB"} min={effectiveBases.memory} max={Math.max(specLimits.memory, effectiveBases.memory)} step={usesMb ? 1024 : 1} onChange={(memory) => setOptions((prev) => (prev ? { ...prev, memory } : prev))} />
              <SpecStepper label={t("shopStorage")} value={options.storage} unit={usesMb ? "MB" : "GB"} min={effectiveBases.storage} max={Math.max(specLimits.storage, effectiveBases.storage)} step={usesMb ? (upgradeConfig?.resourcePricing?.storage?.step ?? 10240) : (upgradeConfig?.resourcePricing?.storage?.step ?? 10)} onChange={(storage) => setOptions((prev) => (prev ? { ...prev, storage } : prev))} />
            </div>
          ) : null}

          {step === "networkUpgrades" && activeProduct ? (
            <div className="space-y-3">
              {(activeProduct.speedUpgradeOptions ?? []).length > 0 ? (
                <select
                  value={options.speedUpgradeGbit}
                  onChange={(event) => setOptions((prev) => (prev ? { ...prev, speedUpgradeGbit: Number(event.target.value) } : prev))}
                  className="w-full rounded-xl border border-(--border) bg-(--bg-base) px-3 py-2.5 text-sm"
                >
                  <option value={0}>{t("configuratorMinNetworkSpeedAny")}</option>
                  {(activeProduct.speedUpgradeOptions ?? []).map((row) => (
                    <option key={row.gbit} value={row.gbit}>
                      {row.gbit} Gbit/s (+{fmt(row.priceGross)})
                    </option>
                  ))}
                </select>
              ) : null}
              {(activeProduct.maxTrafficAddonTb ?? 0) > 0 ? (
                <SpecStepper label={t("configuratorTrafficAddonLabel")} value={options.trafficAddonTb} unit="TB" min={0} max={activeProduct.maxTrafficAddonTb ?? 0} step={1} onChange={(trafficAddonTb) => setOptions((prev) => (prev ? { ...prev, trafficAddonTb } : prev))} />
              ) : null}
            </div>
          ) : null}

          {step === "system" && activeProduct ? (
            <div className="space-y-4">
              {(activeProduct.pterodactylEggs ?? []).length > 0 ? (
                <div className="grid gap-2">
                  {(activeProduct.pterodactylEggs ?? []).map((egg) => (
                    <WizardOption
                      key={egg.eggId}
                      label={egg.displayName ?? egg.name ?? `Egg ${egg.eggId}`}
                      selected={options.eggId === egg.eggId}
                      onSelect={() =>
                        setOptions((prev) =>
                          prev
                            ? { ...prev, eggId: egg.eggId, nestId: egg.nestId, environment: {}, providerVariables: {} }
                            : prev,
                        )
                      }
                    />
                  ))}
                </div>
              ) : null}
              {selectedEgg && (selectedEgg.dockerImages?.length ?? 0) > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedEgg.dockerImages!.map((image) => (
                    <WizardOption
                      key={image}
                      label={image.split(":").pop()?.replace(/[_-]/g, " ") ?? image}
                      selected={options.dockerImage === image}
                      onSelect={() => setOptions((prev) => (prev ? { ...prev, dockerImage: image } : prev))}
                    />
                  ))}
                </div>
              ) : null}
              {selectedEgg ? (
                <EggEnvironmentFields
                  egg={selectedEgg}
                  environmentValues={options.environment ?? {}}
                  onEnvironmentChange={(key, value) =>
                    setOptions((prev) => (prev ? { ...prev, environment: { ...(prev.environment ?? {}), [key]: value } } : prev))
                  }
                />
              ) : null}
              {selectedEgg && (selectedEgg.providerVariables?.length ?? 0) > 0 ? (
                <ProviderVariableFields
                  variables={selectedEgg.providerVariables ?? []}
                  values={options.providerVariables ?? {}}
                  onChange={(name, value) =>
                    setOptions((prev) =>
                      prev ? { ...prev, providerVariables: { ...(prev.providerVariables ?? {}), [name]: value } } : prev,
                    )
                  }
                />
              ) : null}
              {templates.length > 0 ? (
                <select
                  value={options.selectedTemplateId ?? ""}
                  onChange={(event) =>
                    setOptions((prev) =>
                      prev ? { ...prev, selectedTemplateId: event.target.value ? Number(event.target.value) : undefined } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-(--border) bg-(--bg-base) px-3 py-2.5 text-sm"
                >
                  <option value="">{t("configuratorOsTemplatePlaceholder")}</option>
                  {templates.map((template) => (
                    <option key={template.templateId} value={template.templateId}>
                      {template.displayName || template.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}

          {step === "access" ? (
            <div className="space-y-3">
              {providerType === "PLOI" ? (
                <div className="space-y-3 rounded-xl border border-(--border) bg-(--bg-base) p-3">
                  <p className="text-sm font-medium text-(--text-primary)">{t("ploiShopTitle")}</p>
                  <label className="block space-y-1">
                    <span className="text-xs text-(--text-muted)">{t("ploiDomain")}</span>
                    <input
                      className="w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm"
                      value={options.domain ?? ""}
                      placeholder="example.com"
                      onChange={(event) =>
                        setOptions((prev) => (prev ? { ...prev, domain: event.target.value } : prev))
                      }
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(["owned", "external"] as const).map((mode) => (
                      <WizardOption
                        key={mode}
                        label={mode === "owned" ? t("ploiDomainModeOwned") : t("ploiDomainModeExternal")}
                        selected={(options.domainMode ?? "external") === mode}
                        onSelect={() => setOptions((prev) => (prev ? { ...prev, domainMode: mode } : prev))}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {providerType === "PLESK" && activeProduct ? (
                <div className="space-y-3 rounded-xl border border-(--border) bg-(--bg-base) p-3">
                  <p className="text-sm font-medium text-(--text-primary)">{t("pleskShopTitle")}</p>
                  <p className="text-xs text-(--text-muted)">{t("pleskShopDesc")}</p>
                  <SpecStepper
                    label={t("pleskLimitDomainsLabel")}
                    value={options.maxDomains ?? activeProduct.maxDomains ?? 1}
                    unit=""
                    min={activeProduct.maxDomains ?? 1}
                    max={Math.max(
                      activeProduct.maxDomains ?? 1,
                      upgradeConfig?.resourcePricing?.maxDomains?.max ?? (activeProduct.maxDomains ?? 1) + 10,
                    )}
                    step={upgradeConfig?.resourcePricing?.maxDomains?.step ?? 1}
                    onChange={(maxDomains) =>
                      setOptions((prev) => (prev ? { ...prev, maxDomains } : prev))
                    }
                  />
                  <SpecStepper
                    label={t("pleskLimitStoragePerDomainLabel")}
                    value={
                      options.storagePerDomainGb ??
                      (typeof activeProduct.storagePerDomainGb === "number"
                        ? activeProduct.storagePerDomainGb
                        : 5)
                    }
                    unit="GB"
                    min={
                      typeof activeProduct.storagePerDomainGb === "number"
                        ? activeProduct.storagePerDomainGb
                        : 5
                    }
                    max={Math.max(
                      typeof activeProduct.storagePerDomainGb === "number"
                        ? activeProduct.storagePerDomainGb
                        : 5,
                      upgradeConfig?.resourcePricing?.storagePerDomainGb?.max ??
                        (typeof activeProduct.storagePerDomainGb === "number"
                          ? activeProduct.storagePerDomainGb
                          : 5) + 50,
                    )}
                    step={upgradeConfig?.resourcePricing?.storagePerDomainGb?.step ?? 1}
                    onChange={(storagePerDomainGb) =>
                      setOptions((prev) => (prev ? { ...prev, storagePerDomainGb } : prev))
                    }
                  />
                  {(activeProduct.maxMailboxesPerDomain ?? -1) >= 0 ||
                  (activeProduct.storagePerMailboxGb ?? -1) >= 0 ? (
                    <>
                      <SpecStepper
                        label={t("pleskLimitMailboxesPerDomainLabel")}
                        value={
                          options.maxMailboxesPerDomain ??
                          Math.max(0, activeProduct.maxMailboxesPerDomain ?? 0)
                        }
                        unit=""
                        min={Math.max(0, activeProduct.maxMailboxesPerDomain ?? 0)}
                        max={Math.max(
                          Math.max(0, activeProduct.maxMailboxesPerDomain ?? 0),
                          upgradeConfig?.resourcePricing?.maxMailboxesPerDomain?.max ??
                            Math.max(0, activeProduct.maxMailboxesPerDomain ?? 0) + 50,
                        )}
                        step={upgradeConfig?.resourcePricing?.maxMailboxesPerDomain?.step ?? 1}
                        onChange={(maxMailboxesPerDomain) =>
                          setOptions((prev) => (prev ? { ...prev, maxMailboxesPerDomain } : prev))
                        }
                      />
                      <SpecStepper
                        label={t("pleskLimitStoragePerMailboxLabel")}
                        value={
                          options.storagePerMailboxGb ??
                          Math.max(0, activeProduct.storagePerMailboxGb ?? 0)
                        }
                        unit="GB"
                        min={Math.max(0, activeProduct.storagePerMailboxGb ?? 0)}
                        max={Math.max(
                          Math.max(0, activeProduct.storagePerMailboxGb ?? 0),
                          upgradeConfig?.resourcePricing?.storagePerMailboxGb?.max ??
                            Math.max(0, activeProduct.storagePerMailboxGb ?? 0) + 20,
                        )}
                        step={upgradeConfig?.resourcePricing?.storagePerMailboxGb?.step ?? 1}
                        onChange={(storagePerMailboxGb) =>
                          setOptions((prev) => (prev ? { ...prev, storagePerMailboxGb } : prev))
                        }
                      />
                    </>
                  ) : null}
                  {(activeProduct.dnsManagement ?? -1) >= 0 ? (
                    <SpecStepper
                      label={t("pleskLimitDnsLabel")}
                      value={options.dnsManagement ?? Math.max(0, activeProduct.dnsManagement ?? 0)}
                      unit=""
                      min={Math.max(0, activeProduct.dnsManagement ?? 0)}
                      max={1}
                      step={1}
                      onChange={(dnsManagement) =>
                        setOptions((prev) => (prev ? { ...prev, dnsManagement } : prev))
                      }
                    />
                  ) : null}
                </div>
              ) : null}
              {locations.length > 0 ? (
                <select
                  value={options.selectedLocationId ?? ""}
                  onChange={(event) =>
                    setOptions((prev) => (prev ? { ...prev, selectedLocationId: event.target.value || undefined } : prev))
                  }
                  className="w-full rounded-xl border border-(--border) bg-(--bg-base) px-3 py-2.5 text-sm"
                >
                  <option value="">{t("configuratorLocationPlaceholder")}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                      {location.city ? ` · ${location.city}` : ""}
                    </option>
                  ))}
                </select>
              ) : null}

              {hasIpSupport ? (
                <div className="space-y-2 rounded-xl border border-(--border) bg-(--bg-base) p-3">
                  <label className="flex items-center gap-2 text-sm text-(--text-primary)">
                    <input
                      type="checkbox"
                      checked={options.includeIPv4}
                      onChange={(event) => {
                        if (!event.target.checked && !options.includeIPv6) return;
                        setOptions((prev) =>
                          prev
                            ? {
                                ...prev,
                                includeIPv4: event.target.checked,
                                additionalIPv4: event.target.checked ? prev.additionalIPv4 : 0,
                              }
                            : prev,
                        );
                      }}
                    />
                    IPv4
                    {(upgradeConfig?.ipv4OptOutDiscount ?? 0) > 0 && !options.includeIPv4 ? (
                      <span className="text-xs text-(--success)">
                        −{fmt(upgradeConfig!.ipv4OptOutDiscount!)}
                      </span>
                    ) : null}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-(--text-primary)">
                    <input
                      type="checkbox"
                      checked={options.includeIPv6}
                      onChange={(event) => {
                        if (!event.target.checked && !options.includeIPv4) return;
                        setOptions((prev) =>
                          prev
                            ? {
                                ...prev,
                                includeIPv6: event.target.checked,
                                additionalIPv6: event.target.checked ? prev.additionalIPv6 : 0,
                              }
                            : prev,
                        );
                      }}
                    />
                    IPv6
                  </label>
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
                    onChange={(additionalIPv4) =>
                      setOptions((prev) => (prev ? { ...prev, additionalIPv4 } : prev))
                    }
                    disabled={!options.includeIPv4}
                  />
                  <SpecStepper
                    label={`${t("configuratorAdditionalIpv6")}${
                      ipv6Unit > 0 ? ` (+${fmt(ipv6Unit)})` : ""
                    }`}
                    value={options.additionalIPv6}
                    unit=""
                    min={0}
                    max={maxIPv6}
                    step={1}
                    onChange={(additionalIPv6) =>
                      setOptions((prev) => (prev ? { ...prev, additionalIPv6 } : prev))
                    }
                    disabled={!options.includeIPv6}
                  />
                </div>
              ) : null}

              {canAddSshKey ? (
                <div className="space-y-2 rounded-xl border border-(--border) bg-(--bg-base) p-3">
                  <p className="text-sm font-medium text-(--text-primary)">{t("sshKeysSelectForOrder")}</p>
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
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...options.sshKeyIds, key.id]
                                : options.sshKeyIds.filter((id) => id !== key.id);
                              setOptions((prev) => (prev ? { ...prev, sshKeyIds: next } : prev));
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
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "checkout" ? (
            <div className="space-y-4">
              {allowedBillingCycles.length > 1 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-(--text-primary)">{t("configuratorBillingCycleLabel")}</p>
                  <div className="flex flex-wrap gap-2">
                    {allowedBillingCycles.map((cycle) => {
                      const price = Math.max(
                        0,
                        computePeriodPrice(basePriceMonthly, cycle, billingOptions) +
                          computePeriodPrice(ipPriceMonthly, cycle, billingOptions) -
                          computePeriodPrice(ipv4OptOutDiscount, cycle, billingOptions),
                      );
                      return (
                        <WizardOption
                          key={cycle}
                          label={`${t("productDays").replace("{days}", String(cycle))} · ${fmt(price)}`}
                          selected={options.billingCycle === cycle}
                          onSelect={() => setOptions((prev) => (prev ? { ...prev, billingCycle: cycle } : prev))}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[7, 14, 30, 60, 90, 120, 180, 365].map((cycle) => {
                    const price = Math.max(
                      0,
                      computePeriodPrice(basePriceMonthly, cycle, billingOptions) +
                        computePeriodPrice(ipPriceMonthly, cycle, billingOptions) -
                        computePeriodPrice(ipv4OptOutDiscount, cycle, billingOptions),
                    );
                    return (
                      <WizardOption
                        key={cycle}
                        label={`${t("productDays").replace("{days}", String(cycle))} · ${fmt(price)}`}
                        selected={options.billingCycle === cycle}
                        onSelect={() => setOptions((prev) => (prev ? { ...prev, billingCycle: cycle } : prev))}
                      />
                    );
                  })}
                </div>
              )}

              {costBreakdown.length > 0 ? (
                <div className="rounded-xl border border-(--border) bg-(--bg-base) p-4">
                  <h4 className="text-sm font-medium text-(--text-primary)">{t("configuratorCostSummary")}</h4>
                  <ul className="mt-3 divide-y divide-(--border)">
                    {costBreakdown.map((row, index) => (
                      <li key={index} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 text-(--text-secondary)">{row.label}</span>
                        <span className={`shrink-0 font-medium ${row.isDiscount ? "text-(--success)" : "text-(--text-primary)"}`}>
                          {row.isDiscount ? "−" : ""}
                          {fmt(Math.abs(row.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-(--border) pt-3 text-base font-semibold">
                    <span>{t("configuratorCostTotal")}</span>
                    <span>
                      {fmt(periodPrice)} / {billingCycle} {t("days")} · {vat}
                    </span>
                  </div>
                </div>
              ) : null}

              <FairUseAcceptLabel
                checked={fairUseAccepted}
                onChange={setFairUseAccepted}
                acceptPrefix={fairUseCopy.acceptPrefix}
                acceptSuffix={fairUseCopy.acceptSuffix}
                policyLabel={fairUseCopy.policyLabel}
              />
            </div>
          ) : null}

          <div className="pt-2">
            {step === "checkout" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!picked || adding || checkingAvailability || !fairUseAccepted}
                  onClick={() => void addConfigured(false)}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                >
                  {adding || checkingAvailability ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="size-4" />
                  )}
                  {t("configuratorAddToCart")}
                </button>
                <button
                  type="button"
                  disabled={!picked || adding || checkingAvailability || !fairUseAccepted}
                  onClick={() => void addConfigured(true)}
                  className="btn-secondary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                >
                  {t("configuratorGoToCheckout")}
                </button>
                {stepIndex > 0 ? (
                  <button type="button" onClick={goBack} className="btn-secondary w-full rounded-xl py-2.5 text-sm">
                    {t("configuratorWizardBack")}
                  </button>
                ) : null}
              </div>
            ) : (
              <WizardNav
                onBack={stepIndex > 0 ? goBack : undefined}
                onNext={goNext}
                backLabel={t("configuratorWizardBack")}
                nextLabel={t("configuratorWizardNext")}
                nextDisabled={step === "performance" && !picked}
                showBack={stepIndex > 0}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
