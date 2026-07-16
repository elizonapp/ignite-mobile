import { ArrowRight, Cpu, HardDrive, MemoryStick, Star } from "lucide-react";

import { useI18n } from "../../i18n";
import { isElizonPlusCustomerUiVisible } from "../../lib/elizon-plus";
import type { AuthUser } from "../../lib/types";
import {
  countPlansInSubtree,
  findLowestMonthlyPrice,
  pickCategoryImage,
  type ShopCategory,
  type ShopProduct,
} from "../../lib/shop-catalog";
import type { PlanCardRowSync } from "./shop-plan-utils";
import { productAvailabilityText } from "./shop-plan-utils";
import { displayShopPrice, vatLabelFromContext, type CardPricing } from "./shop-pricing";

export type { CardPricing };

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
              {displayShopPrice(lowest, lang, pricing.priceContext)}
            </span>
            <span className={`text-[10px] ${imageUrl ? "text-white/55" : "text-(--text-muted)"}`}>
              {vatLabelFromContext(pricing.priceContext, lang)}
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
          <div className="mt-4 flex flex-wrap items-baseline gap-1.5">
            <span className={`text-xs uppercase tracking-wide ${imageUrl ? "text-white/60" : "text-(--text-muted)"}`}>
              {t("categoryTrustStartingAt")}
            </span>
            <span className={`text-base font-semibold ${imageUrl ? "text-white" : "text-(--text-primary)"}`}>
              {displayShopPrice(lowest, lang, pricing.priceContext)}
            </span>
            <span className={`text-[10px] ${imageUrl ? "text-white/55" : "text-(--text-muted)"}`}>
              {vatLabelFromContext(pricing.priceContext, lang)}
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
  onDirectToCheckout,
  pricing,
  rowSync,
  isBestValue,
  user,
  onElizonPlusClick,
}: {
  product: ShopProduct;
  category: ShopCategory;
  onView: () => void;
  onDirectToCheckout?: () => void;
  pricing: CardPricing;
  rowSync?: PlanCardRowSync;
  isBestValue?: boolean;
  user?: AuthUser | null;
  onElizonPlusClick?: () => void;
}) {
  const { t, lang } = useI18n();
  const fmt = (value: number | string) => displayShopPrice(value, lang, pricing.priceContext);
  const vat = vatLabelFromContext(pricing.priceContext, lang);

  const elizonPlusCustomerSurfaceVisible = isElizonPlusCustomerUiVisible(user);
  const isElizonPlusActive = Boolean(elizonPlusCustomerSurfaceVisible && user?.elizonPlusActive);

  const monthlyOfferDiscount = Number(product.monthlyOffer?.discountPercent ?? 0);
  const hasMonthlyOffer = !product.soldOut && monthlyOfferDiscount > 0;
  const showDiscountedPrice = hasMonthlyOffer && isElizonPlusActive;
  const showPotentialSavings = Boolean(elizonPlusCustomerSurfaceVisible && hasMonthlyOffer && !isElizonPlusActive);
  const listMonthly = parseFloat(String(product.priceMonthly)) || 0;
  const promo = product.promotion;
  const hasCampaignPromo =
    !product.soldOut &&
    !showDiscountedPrice &&
    Boolean(promo?.active) &&
    typeof promo?.discountedPriceMonthly === "number" &&
    promo.discountedPriceMonthly < listMonthly - 0.004;
  const discountedMonthlyPrice = showDiscountedPrice ? listMonthly * (1 - monthlyOfferDiscount / 100) : null;

  const scarcityPromo = product.promotionScarcityRemaining;
  const scarcityCatalog = product.catalogAvailabilityRemaining;
  const showScarcityPromo =
    Boolean(promo?.active) && typeof scarcityPromo === "number" && scarcityPromo >= 1 && scarcityPromo <= 5;
  const showScarcityCatalog =
    !showScarcityPromo && typeof scarcityCatalog === "number" && scarcityCatalog >= 1 && scarcityCatalog <= 5;
  const lowest30 = product.lowestPriceMonthly30d != null ? Number(product.lowestPriceMonthly30d) : listMonthly;
  const showLowestBlock = Boolean(product.showLowestPrice30dHint) && !product.soldOut;
  const availabilityText = productAvailabilityText(product, t);

  const sync = rowSync ?? {
    bestValueBadge: false,
    chip: Boolean(product.chip),
    headerPotentialSavings: showPotentialSavings,
    scarcityLine: showScarcityPromo || showScarcityCatalog,
    lowest30Line: showLowestBlock,
    tallPriceBand: showDiscountedPrice || hasCampaignPromo || product.soldOut,
    footerElizon: showPotentialSavings,
    soldOutSplit: false,
    hasDescription: Boolean(product.description),
  };

  return (
    <div
      className={`glass flex h-full min-h-0 flex-col gap-3 p-5 transition-all ${
        isBestValue && !product.soldOut ? "border-(--primary) ring-2 ring-(--primary)/25" : ""
      } ${product.soldOut ? "opacity-85" : "hover:border-(--primary)/40"}`}
    >
      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        {sync.bestValueBadge ? (
          <div className="mb-2 flex min-h-[2rem] items-center justify-center">
            {isBestValue && !product.soldOut ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-(--primary)/10 px-2.5 py-1 text-xs font-medium text-(--primary)">
                <Star className="size-3.5 fill-current" />
                {t("productBestValue")}
              </div>
            ) : (
              <span className="invisible inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs" aria-hidden>
                {t("productBestValue")}
              </span>
            )}
          </div>
        ) : isBestValue && !product.soldOut ? (
          <div className="mb-2 flex justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-(--primary)/10 px-2.5 py-1 text-xs font-medium text-(--primary)">
              <Star className="size-3.5 fill-current" />
              {t("productBestValue")}
            </div>
          </div>
        ) : null}

        <h3 className="text-center text-lg font-semibold text-(--text-primary)">{product.name}</h3>

        {sync.chip ? (
          <div className="mt-1 flex min-h-[1.125rem] items-center justify-center">
            {product.chip ? (
              <p className="text-xs uppercase tracking-wide text-(--text-muted)">{product.chip}</p>
            ) : (
              <span className="invisible text-xs" aria-hidden>
                —
              </span>
            )}
          </div>
        ) : product.chip ? (
          <p className="mt-1 text-center text-xs uppercase tracking-wide text-(--text-muted)">{product.chip}</p>
        ) : null}

        <div className={sync.tallPriceBand || sync.soldOutSplit ? "mt-2 flex min-h-[5rem] flex-col items-center" : "mt-2 text-center"}>
          {product.soldOut ? (
            <div className="inline-flex rounded-full bg-(--text-muted)/20 px-2.5 py-1 text-xs font-medium text-(--text-muted)">
              {t("productSoldOut")}
            </div>
          ) : showDiscountedPrice && discountedMonthlyPrice != null ? (
            <>
              <div className="inline-flex rounded-full bg-(--primary)/12 px-2.5 py-1 text-[11px] font-semibold text-(--primary)">
                {t("elizonPlusMonthlyOfferBadge").replace("{percent}", String(monthlyOfferDiscount))}*
              </div>
              <div className="mt-2 text-2xl font-bold text-(--text-primary)">{fmt(discountedMonthlyPrice)}</div>
              <div className="mt-1 text-xs text-(--text-muted)">
                <span className="line-through">{fmt(product.priceMonthly ?? 0)}</span> · {t("productPerMonth")} {vat}
              </div>
            </>
          ) : hasCampaignPromo && promo ? (
            <>
              <div className="text-2xl font-bold text-(--error)">{fmt(promo.discountedPriceMonthly)}</div>
              <div className="mt-1 text-xs text-(--text-muted)">
                <span className="line-through">{fmt(listMonthly)}</span> · {t("productPerMonth")} {vat}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-(--text-primary)">{fmt(product.priceMonthly ?? 0)}</div>
              <div className="mt-1 text-xs text-(--text-muted)">
                {t("productPerMonth")} {vat}
              </div>
            </>
          )}
        </div>

        {sync.headerPotentialSavings && showPotentialSavings ? (
          <p className="mt-2 text-center text-xs font-medium text-(--primary)">
            {t("elizonPlusPotentialSavingsBadge").replace("{percent}", String(monthlyOfferDiscount))}
          </p>
        ) : null}

        <p className={`mt-2 text-center text-xs font-medium ${product.soldOut ? "text-(--warning)" : "text-(--success)"}`}>
          {availabilityText}
        </p>

        {showScarcityPromo ? (
          <p className="mt-1.5 text-center text-xs text-(--text-muted)">
            {t("productScarcityPromotion").replace("{count}", String(scarcityPromo))}
          </p>
        ) : showScarcityCatalog ? (
          <p className="mt-1.5 text-center text-xs text-(--text-muted)">
            {t("productScarcityCatalog").replace("{count}", String(scarcityCatalog))}
          </p>
        ) : null}

        {showLowestBlock ? (
          <p className="mt-1.5 text-center text-xs text-(--text-muted)">
            {t("productLowestPrice30d").replace("{price}", fmt(lowest30))}
          </p>
        ) : null}
      </button>

      {(product.schemaCardFields?.length || product.vcores || product.memory || product.storage) ? (
        <div className="flex flex-wrap justify-center gap-2">
          {product.schemaCardFields?.map((field) => (
            <Spec key={`${field.label}-${field.value}`} label={`${field.label}: ${field.value}`} />
          ))}
          {!!product.vcores && !product.schemaCardFields?.length ? (
            <Spec icon={<Cpu className="size-3" />} label={`${product.vcores} vCPU`} />
          ) : null}
          {!!product.memory && !product.schemaCardFields?.length ? (
            <Spec icon={<MemoryStick className="size-3" />} label={`${product.memory} GB RAM`} />
          ) : null}
          {!!product.storage && !product.schemaCardFields?.length ? (
            <Spec icon={<HardDrive className="size-3" />} label={`${product.storage} GB`} />
          ) : null}
        </div>
      ) : null}

      {sync.hasDescription && product.description ? (
        <p className="line-clamp-2 text-center text-xs text-(--text-secondary)">{product.description}</p>
      ) : product.description ? (
        <p className="line-clamp-2 text-center text-xs text-(--text-secondary)">{product.description}</p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        {showPotentialSavings && onElizonPlusClick ? (
          <button type="button" onClick={onElizonPlusClick} className="btn-secondary w-full rounded-xl px-3 py-2 text-xs font-semibold text-(--primary)">
            {t("elizonPlusSubscribeAndSave")}
          </button>
        ) : null}
        <button type="button" onClick={onView} className="btn-secondary w-full rounded-xl px-3 py-2.5 text-sm font-semibold">
          {t("categoryViewDetails")}
        </button>
        {!product.soldOut && onDirectToCheckout ? (
          <button type="button" onClick={onDirectToCheckout} className="btn-primary w-full rounded-xl px-3 py-2.5 text-sm font-semibold">
            {t("productGoToCheckout")}
          </button>
        ) : product.soldOut ? (
          <button type="button" disabled className="btn-secondary w-full rounded-xl px-3 py-2.5 text-sm font-semibold opacity-50">
            {t("productGoToCheckout")}
          </button>
        ) : null}
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
