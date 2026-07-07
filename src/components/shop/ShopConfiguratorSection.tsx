import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";

import { useCart } from "../cart/CartProvider";
import { useToast } from "../Toast";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { buildConfiguredCartItem } from "../../lib/cart-configured";
import { getBillingOptions } from "../../lib/product-pricing";
import { computePeriodPrice } from "../../lib/billing";
import {
  formatPortSpeed,
  getAvailableNetworkTiers,
  pickBaseProduct,
  type ConfiguratorTargetSpecs,
} from "../../lib/category-configurator";
import type { ShopBusinessPricing, ShopCategory } from "../../lib/shop-catalog";
import {
  numSpec,
  type ConfiguratorProviderOptions,
  type ShopLocationOption,
  type ShopProductDetail,
  type ShopTemplateOption,
  type ShopUpgradeConfig,
  usesMbResources,
} from "../../lib/shop-product-detail";
import { displayShopPrice, vatLabel } from "../../features/shop/shop-pricing";
import { FairUseAcceptLabel, useFairUseAcceptCopy } from "../../components/ui/fair-use-accept-label";
import { SpecStepper, WizardNav, WizardOption } from "./wizard-shell";

type ConfiguratorStep = "filter" | "performance" | "networkUpgrades" | "system" | "access" | "checkout";

type ShopConfiguratorSectionProps = {
  category: ShopCategory;
  pricing: {
    isBusiness: boolean;
    businessPricing?: ShopBusinessPricing | null;
    defaultTaxName?: string;
  };
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
  const { show } = useToast();
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProductDetail[]>([]);
  const [upgradeConfig, setUpgradeConfig] = useState<ShopUpgradeConfig | null>(null);
  const [locations, setLocations] = useState<ShopLocationOption[]>([]);
  const [templates, setTemplates] = useState<ShopTemplateOption[]>([]);
  const [options, setOptions] = useState<ConfiguratorProviderOptions | null>(null);
  const [step, setStep] = useState<ConfiguratorStep>("performance");
  const [adding, setAdding] = useState(false);
  const [fairUseAccepted, setFairUseAccepted] = useState(false);
  const fairUseCopy = useFairUseAcceptCopy();

  const providerType = category.provider?.type?.toUpperCase() ?? "";
  const usesMb = usesMbResources(category.provider?.type);
  const networkTiers = useMemo(() => getAvailableNetworkTiers(products), [products]);

  const steps = useMemo<ConfiguratorStep[]>(() => {
    const list: ConfiguratorStep[] = [];
    if (networkTiers.length > 1) list.push("filter");
    list.push("performance");
    if (providerType === "PROXMOX") list.push("networkUpgrades");
    if (providerType === "PTERODACTYL" || providerType === "PROXMOX") list.push("system");
    list.push("access", "checkout");
    return list;
  }, [networkTiers.length, providerType]);

  const stepIndex = Math.max(0, steps.indexOf(step));

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
        });
        setStep(getAvailableNetworkTiers(detailed).length > 1 ? "filter" : "performance");
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

  const fmt = (value: number) =>
    displayShopPrice(value, lang, pricing.isBusiness, pricing.businessPricing ?? null);

  const periodPrice = useMemo(() => {
    if (!picked || !activeProduct) return 0;
    const billingOptions = getBillingOptions(activeProduct);
    return computePeriodPrice(picked.totalMonthly, options?.billingCycle ?? 30, billingOptions);
  }, [picked, activeProduct, options?.billingCycle]);

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

  const addConfiguredToCart = async () => {
    if (!options || !activeProduct || picked == null) return;
    if (!fairUseAccepted) return;
    if (locations.length > 0 && !options.selectedLocationId) {
      show(t("configuratorLocationRequired"), "error");
      return;
    }
    setAdding(true);
    try {
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
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setAdding(false);
    }
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
                / {options?.billingCycle ?? 30} {t("days")} · {vatLabel(pricing.isBusiness, pricing.defaultTaxName, lang)}
              </p>
            </>
          ) : (
            <p className="text-sm text-(--warning)">{t("configuratorNoMatchingPlan")}</p>
          )}
        </div>
      </div>

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
            <div className="space-y-3">
              {(activeProduct.pterodactylEggs ?? []).length > 0 ? (
                <div className="grid gap-2">
                  {(activeProduct.pterodactylEggs ?? []).map((egg) => (
                    <WizardOption
                      key={egg.eggId}
                      label={egg.displayName ?? egg.name ?? `Egg ${egg.eggId}`}
                      selected={options.eggId === egg.eggId}
                      onSelect={() => setOptions((prev) => (prev ? { ...prev, eggId: egg.eggId, nestId: egg.nestId } : prev))}
                    />
                  ))}
                </div>
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
              {providerType === "PROXMOX" ? (
                <>
                  <SpecStepper label={t("configuratorAdditionalIpv4")} value={options.additionalIPv4} unit="" min={0} max={Number(activeProduct?.providerCapabilities?.maxIPv4 ?? 5)} step={1} onChange={(additionalIPv4) => setOptions((prev) => (prev ? { ...prev, additionalIPv4 } : prev))} />
                  <SpecStepper label={t("configuratorAdditionalIpv6")} value={options.additionalIPv6} unit="" min={0} max={Number(activeProduct?.providerCapabilities?.maxIPv6 ?? 3)} step={1} onChange={(additionalIPv6) => setOptions((prev) => (prev ? { ...prev, additionalIPv6 } : prev))} />
                </>
              ) : null}
            </div>
          ) : null}

          {step === "checkout" ? (
            <div className="space-y-4">
              <p className="text-sm text-(--text-primary)">
                {options.vcores} vCPU · {options.memory} {usesMb ? "MB" : "GB"} RAM · {options.storage} {usesMb ? "MB" : "GB"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[30, 360].map((cycle) => (
                  <WizardOption
                    key={cycle}
                    label={cycle === 30 ? t("configuratorBillingMonthly") : t("configuratorBillingYearly")}
                    selected={options.billingCycle === cycle}
                    onSelect={() => setOptions((prev) => (prev ? { ...prev, billingCycle: cycle } : prev))}
                  />
                ))}
              </div>
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
                  disabled={!picked || adding || !fairUseAccepted}
                  onClick={() => void addConfiguredToCart()}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
                >
                  {adding ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                  {t("configuratorAddToCart")}
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
