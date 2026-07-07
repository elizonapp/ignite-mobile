import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart, SlidersHorizontal } from "lucide-react";

import { useCart } from "../cart/CartProvider";
import { useToast } from "../Toast";
import { useI18n } from "../../i18n";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { api } from "../../lib/api";
import { buildConfiguredCartItem } from "../../lib/cart-configured";
import {
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
  type ShopUpgradeConfig,
  usesMbResources,
} from "../../lib/shop-product-detail";
import { ShopWizardShell, SpecStepper, WizardNav, WizardOption } from "./wizard-shell";

type ConfiguratorStep = "filter" | "performance" | "checkout";

type ShopConfiguratorWizardProps = {
  category: ShopCategory;
  onClose: () => void;
};

function formatPrice(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getEffectiveBases(products: ShopProductDetail[], minNetworkMBs: number) {
  const eligible = products.filter((product) => {
    if (product.soldOut) return false;
    if (minNetworkMBs <= 0) return true;
    const speed = Number(product.networkLimitMBs ?? 0);
    return Number.isFinite(speed) && speed >= minNetworkMBs;
  });

  if (eligible.length === 0) {
    return { vcores: 1, memory: 1, storage: 1 };
  }

  return {
    vcores: Math.min(...eligible.map((product) => numSpec(product.vcores, Number.POSITIVE_INFINITY))),
    memory: Math.min(...eligible.map((product) => numSpec(product.memory, Number.POSITIVE_INFINITY))),
    storage: Math.min(...eligible.map((product) => numSpec(product.storage, Number.POSITIVE_INFINITY))),
  };
}

function getSpecLimits(
  products: ShopProductDetail[],
  upgradeConfig: ShopUpgradeConfig | null,
  minNetworkMBs: number,
) {
  const eligible = products.filter((product) => {
    if (product.soldOut) return false;
    if (minNetworkMBs <= 0) return true;
    const speed = Number(product.networkLimitMBs ?? 0);
    return Number.isFinite(speed) && speed >= minNetworkMBs;
  });

  const rp = upgradeConfig?.resourcePricing;
  const maxFromProducts = {
    vcores: Math.max(...eligible.map((product) => numSpec(product.vcores, 0)), 0),
    memory: Math.max(...eligible.map((product) => numSpec(product.memory, 0)), 0),
    storage: Math.max(...eligible.map((product) => numSpec(product.storage, 0)), 0),
  };

  return {
    vcores: Math.max(maxFromProducts.vcores, rp?.vcores?.max ?? maxFromProducts.vcores),
    memory: Math.max(maxFromProducts.memory, rp?.memory?.max ?? maxFromProducts.memory),
    storage: Math.max(maxFromProducts.storage, rp?.storage?.max ?? maxFromProducts.storage),
  };
}

export function ShopConfiguratorWizard({ category, onClose }: ShopConfiguratorWizardProps) {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProductDetail[]>([]);
  const [upgradeConfig, setUpgradeConfig] = useState<ShopUpgradeConfig | null>(null);
  const [locations, setLocations] = useState<ShopLocationOption[]>([]);
  const [options, setOptions] = useState<ConfiguratorProviderOptions | null>(null);
  const [step, setStep] = useState<ConfiguratorStep>("performance");
  const [adding, setAdding] = useState(false);

  const usesMb = usesMbResources(category.provider?.type);
  const networkTiers = useMemo(() => getAvailableNetworkTiers(products), [products]);
  const hasFilterStep = networkTiers.length > 1;

  const steps = useMemo<ConfiguratorStep[]>(() => {
    const list: ConfiguratorStep[] = [];
    if (hasFilterStep) list.push("filter");
    list.push("performance", "checkout");
    return list;
  }, [hasFilterStep]);

  const stepIndex = steps.indexOf(step);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const slugs = category.products.map((product) => product.slug).filter(Boolean);
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
        });

        if (getAvailableNetworkTiers(detailed).length > 1) {
          setStep("filter");
        } else {
          setStep("performance");
        }
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
  const effectiveBases = useMemo(
    () => getEffectiveBases(products, minNetworkMBs),
    [products, minNetworkMBs],
  );
  const specLimits = useMemo(
    () => getSpecLimits(products, upgradeConfig, minNetworkMBs),
    [products, upgradeConfig, minNetworkMBs],
  );

  const target: ConfiguratorTargetSpecs | null = options
    ? {
        vcores: options.vcores,
        memory: options.memory,
        storage: options.storage,
        minNetworkMBs: options.minNetworkMBs,
      }
    : null;

  const picked = useMemo(() => {
    if (!target || products.length === 0) return null;
    return pickBaseProduct(products, target, upgradeConfig, usesMb);
  }, [products, target, upgradeConfig, usesMb]);

  const activeProduct = picked?.product as ShopProductDetail | undefined;

  useEffect(() => {
    if (!activeProduct?.id || locations.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.shop.productLocations(activeProduct.id);
        if (cancelled || !data?.success) return;
        const list = Array.isArray(data.locations) ? data.locations : [];
        setLocations(list);
        if (list.length === 1) {
          setOptions((prev) => (prev ? { ...prev, selectedLocationId: list[0]?.id } : prev));
        }
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProduct?.id, locations.length]);

  const memoryUnit = usesMb ? "MB" : "GB";
  const storageUnit = usesMb ? "MB" : "GB";
  const memoryStep = usesMb ? 1024 : 1;
  const storageStep = usesMb ? (upgradeConfig?.resourcePricing?.storage?.step ?? 10240) : (upgradeConfig?.resourcePricing?.storage?.step ?? 10);

  const stepTitle =
    step === "filter"
      ? t("configuratorStepFilterTitle")
      : step === "performance"
        ? t("configuratorStepPerformanceTitle")
        : t("configuratorStepCheckoutTitle");

  const stepDescription =
    step === "filter"
      ? t("configuratorStepFilterDescription")
      : step === "performance"
        ? t("configuratorStepPerformanceDescription")
        : t("configuratorStepCheckoutDescription");

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
        }),
      );
      show(t("productAddedToCart"), "success");
      onClose();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <ShopWizardShell
        title={t("configuratorTitle")}
        stepIndex={0}
        stepCount={steps.length}
        stepLabel={t("configuratorWizardProgress").replace("{current}", "1").replace("{total}", String(steps.length))}
        onClose={onClose}
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-(--elizon-primary)" />
        </div>
      </ShopWizardShell>
    );
  }

  if (error || products.length === 0) {
    return (
      <ShopWizardShell
        title={t("configuratorTitle")}
        stepIndex={0}
        stepCount={1}
        stepLabel={t("configuratorTitle")}
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose} className="btn-secondary w-full rounded-xl py-2.5 text-sm">
            {t("cancel")}
          </button>
        }
      >
        <p className="text-sm text-(--error)">{error ?? t("configuratorNoMatchingPlan")}</p>
      </ShopWizardShell>
    );
  }

  return (
    <ShopWizardShell
      title={stepTitle}
      subtitle={stepDescription}
      stepIndex={stepIndex}
      stepCount={steps.length}
      stepLabel={t("configuratorWizardProgress")
        .replace("{current}", String(stepIndex + 1))
        .replace("{total}", String(steps.length))}
      onClose={onClose}
      footer={
        step === "checkout" ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!picked || adding || (locations.length > 0 && !options?.selectedLocationId)}
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
        )
      }
    >
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
              onSelect={() =>
                setOptions((prev) =>
                  prev
                    ? {
                        ...prev,
                        minNetworkMBs: tier,
                        vcores: getEffectiveBases(products, tier).vcores,
                        memory: getEffectiveBases(products, tier).memory,
                        storage: getEffectiveBases(products, tier).storage,
                      }
                    : prev,
                )
              }
            />
          ))}
        </div>
      ) : null}

      {step === "performance" && options ? (
        <div className="space-y-3">
          <SpecStepper
            label="vCPU"
            value={options.vcores}
            unit=""
            min={effectiveBases.vcores}
            max={Math.max(specLimits.vcores, effectiveBases.vcores)}
            step={1}
            disabled={activeProduct?.allowCpuCustomization === false}
            onChange={(vcores) => setOptions((prev) => (prev ? { ...prev, vcores } : prev))}
          />
          <SpecStepper
            label="RAM"
            value={options.memory}
            unit={memoryUnit}
            min={effectiveBases.memory}
            max={Math.max(specLimits.memory, effectiveBases.memory)}
            step={memoryStep}
            disabled={activeProduct?.allowRamCustomization === false}
            onChange={(memory) => setOptions((prev) => (prev ? { ...prev, memory } : prev))}
          />
          <SpecStepper
            label={lang === "de" ? "Speicher" : "Storage"}
            value={options.storage}
            unit={storageUnit}
            min={effectiveBases.storage}
            max={Math.max(specLimits.storage, effectiveBases.storage)}
            step={storageStep}
            disabled={activeProduct?.allowStorageCustomization === false}
            onChange={(storage) => setOptions((prev) => (prev ? { ...prev, storage } : prev))}
          />

          {picked ? (
            <div className="glass mt-4 space-y-1 p-4">
              <p className="text-xs uppercase tracking-wide text-(--text-muted)">{t("configuratorRecommendedPlan")}</p>
              <p className="text-sm font-semibold text-(--text-primary)">{activeProduct?.name}</p>
              <p className="text-base font-bold text-(--elizon-primary)">
                {formatPrice(picked.totalMonthly, lang)}
                <span className="text-xs font-normal text-(--text-muted)"> {t("configuratorPerMonth")}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-(--error)">{t("configuratorNoMatchingPlan")}</p>
          )}
        </div>
      ) : null}

      {step === "checkout" && options ? (
        <div className="space-y-4">
          <div className="glass space-y-2 p-4">
            <div className="flex items-center gap-2 text-(--elizon-primary)">
              <SlidersHorizontal className="size-4" />
              <p className="text-sm font-semibold">{t("configuratorIncluded")}</p>
            </div>
            <p className="text-sm text-(--text-primary)">
              {options.vcores} vCPU · {options.memory} {memoryUnit} RAM · {options.storage} {storageUnit}
            </p>
            {activeProduct ? (
              <p className="text-xs text-(--text-muted)">
                {t("configuratorCostBasePlan").replace("{name}", activeProduct.name)}
              </p>
            ) : null}
            {picked ? (
              <p className="text-xl font-bold text-(--elizon-primary)">
                {formatPrice(picked.totalMonthly, lang)}
                <span className="text-xs font-normal text-(--text-muted)"> {t("configuratorPerMonth")}</span>
              </p>
            ) : null}
          </div>

          {locations.length > 0 ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-(--text-primary)">
                {t("configuratorLocationLabel")}
              </label>
              <select
                value={options.selectedLocationId ?? ""}
                onChange={(event) =>
                  setOptions((prev) =>
                    prev ? { ...prev, selectedLocationId: event.target.value || undefined } : prev,
                  )
                }
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
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-(--text-primary)">
              {t("configuratorBillingCycleLabel")}
            </label>
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
          </div>
        </div>
      ) : null}
    </ShopWizardShell>
  );
}
