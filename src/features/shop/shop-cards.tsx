import { ArrowRight, Cpu, HardDrive, MemoryStick } from "lucide-react";

import { useI18n } from "../../i18n";
import {
  countPlansInSubtree,
  findLowestMonthlyPrice,
  pickCategoryImage,
  type ShopCategory,
  type ShopProduct,
} from "../../lib/shop-catalog";
import { displayShopPrice, formatShopPrice, vatLabel } from "./shop-pricing";

type CardPricing = {
  isBusiness: boolean;
  businessPricing?: { upchargePercent: number; taxRatePercent: number } | null;
  defaultTaxName?: string;
};

function CategoryBackground({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return null;
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center blur-[2px] transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div className="absolute inset-0 bg-black/60" />
    </>
  );
}

export function ShopCategoryCard({
  category,
  onSelect,
  className = "",
  pricing,
}: {
  category: ShopCategory;
  onSelect: () => void;
  className?: string;
  pricing: CardPricing;
}) {
  const { t, lang } = useI18n();
  const imageUrl = pickCategoryImage(category.backgroundImageUrls);
  const lowest = findLowestMonthlyPrice(category);
  const childCount = category.children?.length ?? 0;
  const planCount = category.products?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-[var(--radius-surface)] border border-(--border) p-6 text-left transition-all hover:border-(--primary)/50 ${imageUrl ? "" : "bg-(--bg-elevated)"} ${className}`}
    >
      <CategoryBackground imageUrl={imageUrl} />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <h2 className={`text-lg font-semibold ${imageUrl ? "text-white" : "text-(--text-primary)"}`}>
            {category.name}
          </h2>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
              imageUrl
                ? "border-white/30 text-white group-hover:border-white group-hover:bg-white group-hover:text-black"
                : "border-(--border) text-(--text-secondary) group-hover:border-(--primary) group-hover:bg-(--primary) group-hover:text-white"
            }`}
          >
            <ArrowRight className="size-4" />
          </div>
        </div>
        {category.tagline ? (
          <p className={`mt-1 text-sm ${imageUrl ? "text-white/80" : "text-(--primary)"}`}>{category.tagline}</p>
        ) : null}
        {category.description ? (
          <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${imageUrl ? "text-white/70" : "text-(--text-secondary)"}`}>
            {category.description}
          </p>
        ) : null}
        {lowest != null ? (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className={`text-xs uppercase tracking-wide ${imageUrl ? "text-white/60" : "text-(--text-muted)"}`}>
              {t("categoryTrustStartingAt")}
            </span>
            <span className={`text-base font-semibold ${imageUrl ? "text-white" : "text-(--text-primary)"}`}>
              {displayShopPrice(lowest, lang, pricing.isBusiness, pricing.businessPricing)}
            </span>
            <span className={`text-[10px] ${imageUrl ? "text-white/55" : "text-(--text-muted)"}`}>
              {vatLabel(pricing.isBusiness, pricing.defaultTaxName, lang)}
            </span>
          </div>
        ) : null}
        <p className={`mt-3 text-xs ${imageUrl ? "text-white/50" : "text-(--text-muted)"}`}>
          {childCount > 0
            ? `${childCount} ${childCount === 1 ? t("productsSubcategory") : t("productsSubcategories")}`
            : `${planCount} ${planCount === 1 ? t("shopPlan") : t("shopPlans")}`}
        </p>
      </div>
    </button>
  );
}

export function ShopSubCategoryCard({
  category,
  onSelect,
  className = "",
  pricing,
}: {
  category: ShopCategory;
  onSelect: () => void;
  className?: string;
  pricing: CardPricing;
}) {
  const { t, lang } = useI18n();
  const imageUrl = pickCategoryImage(category.backgroundImageUrls);
  const lowest = findLowestMonthlyPrice(category);
  const planCount = countPlansInSubtree(category);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-[var(--radius-surface)] border border-(--border) p-6 text-left transition-all hover:border-(--primary)/50 ${imageUrl ? "" : "bg-(--bg-elevated)/80"} ${className}`}
    >
      <CategoryBackground imageUrl={imageUrl} />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-lg font-semibold ${imageUrl ? "text-white" : "text-(--text-primary)"}`}>
            {category.name}
          </h3>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
              imageUrl
                ? "border-white/30 text-white group-hover:border-white group-hover:bg-white group-hover:text-black"
                : "border-(--border) text-(--text-secondary) group-hover:border-(--primary) group-hover:bg-(--primary) group-hover:text-white"
            }`}
          >
            <ArrowRight className="size-4" />
          </div>
        </div>
        {category.description ? (
          <p className={`mt-3 line-clamp-2 text-sm ${imageUrl ? "text-white/70" : "text-(--text-secondary)"}`}>
            {category.description}
          </p>
        ) : null}
        {lowest != null ? (
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className={`text-xs uppercase tracking-wide ${imageUrl ? "text-white/60" : "text-(--text-muted)"}`}>
              {t("categoryTrustStartingAt")}
            </span>
            <span className={`text-base font-semibold ${imageUrl ? "text-white" : "text-(--text-primary)"}`}>
              {displayShopPrice(lowest, lang, pricing.isBusiness, pricing.businessPricing)}
            </span>
          </div>
        ) : null}
        <p className={`mt-3 text-xs ${imageUrl ? "text-white/50" : "text-(--text-muted)"}`}>
          {planCount} {planCount === 1 ? t("shopPlan") : t("shopPlans")}
        </p>
      </div>
    </button>
  );
}

export function ShopProductCard({
  product,
  category,
  onView,
  onAddToCart,
  onDirectToCheckout,
  pricing,
}: {
  product: ShopProduct;
  category: ShopCategory;
  onView: () => void;
  onAddToCart: () => void;
  onDirectToCheckout?: () => void;
  pricing: CardPricing;
}) {
  const { t, lang } = useI18n();
  const priceValue = product.priceMonthly != null ? Number(product.priceMonthly) : null;

  return (
    <div className="glass flex h-full flex-col gap-3 p-4">
      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        {product.chip ? (
          <span className="mb-2 inline-block rounded-md bg-(--surface-soft) px-2 py-0.5 text-[10px] font-medium text-(--text-muted)">
            {product.chip}
          </span>
        ) : null}
        <p className="text-sm font-semibold text-(--text-primary)">{product.name}</p>
        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-(--text-muted)">{product.description}</p>
        ) : null}
      </button>

      {(product.vcores || product.memory || product.storage || product.schemaCardFields?.length) ? (
        <div className="flex flex-wrap gap-2">
          {product.schemaCardFields?.map((field) => (
            <Spec key={`${field.label}-${field.value}`} label={`${field.label}: ${field.value}`} />
          ))}
          {!!product.vcores && <Spec icon={<Cpu className="size-3" />} label={`${product.vcores} vCPU`} />}
          {!!product.memory && <Spec icon={<MemoryStick className="size-3" />} label={`${product.memory} GB RAM`} />}
          {!!product.storage && <Spec icon={<HardDrive className="size-3" />} label={`${product.storage} GB`} />}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        {priceValue != null && Number.isFinite(priceValue) ? (
          <div>
            <span className="text-base font-bold text-(--elizon-primary)">
              {displayShopPrice(priceValue, lang, pricing.isBusiness, pricing.businessPricing)}
            </span>
            <span className="text-xs text-(--text-muted)">{t("shopPerMonth")}</span>
          </div>
        ) : (
          <span className="text-xs text-(--text-muted)">—</span>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onView}
            className="btn-secondary w-full rounded-xl px-3 py-2 text-xs font-semibold"
          >
            {t("shopViewDetails")}
          </button>
          {!product.soldOut ? (
            <>
              <button
                type="button"
                onClick={onAddToCart}
                className="btn-primary w-full rounded-xl px-3 py-2 text-xs font-semibold"
              >
                {t("shopAddToCart")}
              </button>
              {onDirectToCheckout ? (
                <button
                  type="button"
                  onClick={onDirectToCheckout}
                  className="btn-secondary w-full rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  {t("productGoToCheckout")}
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" disabled className="btn-secondary w-full rounded-xl px-3 py-2 text-xs font-semibold opacity-50">
              {t("productSoldOut")}
            </button>
          )}
        </div>
      </div>
      <span className="sr-only">{category.name}</span>
    </div>
  );
}

function Spec({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-md bg-(--surface-soft) px-2 py-0.5 text-[10px] text-(--text-muted)">
      {icon}
      {label}
    </span>
  );
}

export { formatShopPrice };
