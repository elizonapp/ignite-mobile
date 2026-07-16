import type { ShopProduct } from "../../lib/shop-catalog";
import type { Dict } from "../../i18n/en";

type Translate = (key: keyof Dict) => string;

export function calculateBestValueSlug(products: ShopProduct[]): string | null {
  if (!products || products.length < 2) return null;

  const available = products.filter((product) => !product.soldOut);
  if (available.length < 2) return null;

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const product of available) {
    const price = parseFloat(String(product.priceMonthly)) || 0;
    if (price <= 0) continue;

    const vcores = typeof product.vcores === "number" ? product.vcores : parseFloat(String(product.vcores)) || 0;
    const memory = typeof product.memory === "number" ? product.memory : parseFloat(String(product.memory)) || 0;
    const storage = typeof product.storage === "number" ? product.storage : parseFloat(String(product.storage)) || 0;

    const memoryGb = memory / 1024;
    const storageGb = storage / 1024;
    const performanceScore = vcores * 80 + memoryGb * 20 + storageGb * 2;
    const valueScore = performanceScore / price;

    if (valueScore > bestScore) {
      bestScore = valueScore;
      bestSlug = product.slug;
    }
  }

  return bestSlug;
}

export type PlanCardRowSync = {
  bestValueBadge: boolean;
  chip: boolean;
  headerPotentialSavings: boolean;
  scarcityLine: boolean;
  lowest30Line: boolean;
  tallPriceBand: boolean;
  footerElizon: boolean;
  soldOutSplit: boolean;
  hasDescription: boolean;
};

export function computePlanCardRowSync(args: {
  products: ShopProduct[];
  bestValueSlug: string | null;
  elizonPlusCustomerSurfaceVisible: boolean;
  isElizonPlusActive: boolean;
}): PlanCardRowSync {
  const { products, bestValueSlug, elizonPlusCustomerSurfaceVisible, isElizonPlusActive } = args;
  const sync: PlanCardRowSync = {
    bestValueBadge: false,
    chip: false,
    headerPotentialSavings: false,
    scarcityLine: false,
    lowest30Line: false,
    tallPriceBand: false,
    footerElizon: false,
    soldOutSplit: false,
    hasDescription: false,
  };

  if (products.length === 0) return sync;

  let anySoldOut = false;
  let anyInStock = false;

  for (const product of products) {
    if (product.soldOut) anySoldOut = true;
    else anyInStock = true;
    if (product.chip) sync.chip = true;
    if (typeof product.description === "string" && product.description.trim()) sync.hasDescription = true;
  }
  sync.soldOutSplit = anySoldOut && anyInStock;

  for (const product of products) {
    const monthlyOfferDiscount = Number(product.monthlyOffer?.discountPercent ?? 0);
    const hasMonthlyOffer = !product.soldOut && monthlyOfferDiscount > 0;
    const listMonthly = parseFloat(String(product.priceMonthly)) || 0;
    const promo = product.promotion;
    const showDiscountedPrice = hasMonthlyOffer && isElizonPlusActive;
    const showPotentialSavings = Boolean(elizonPlusCustomerSurfaceVisible && hasMonthlyOffer && !isElizonPlusActive);
    const hasCampaignPromo =
      !product.soldOut &&
      !showDiscountedPrice &&
      Boolean(promo?.active) &&
      typeof promo?.discountedPriceMonthly === "number" &&
      promo.discountedPriceMonthly < listMonthly - 0.004;

    if (bestValueSlug && product.slug === bestValueSlug && !product.soldOut) sync.bestValueBadge = true;
    if (showPotentialSavings) {
      sync.headerPotentialSavings = true;
      sync.footerElizon = true;
    }
    if (showDiscountedPrice || hasCampaignPromo) sync.tallPriceBand = true;

    const scarcityPromo = product.promotionScarcityRemaining;
    const scarcityCatalog = product.catalogAvailabilityRemaining;
    const showScarcityPromo =
      Boolean(promo?.active) &&
      typeof scarcityPromo === "number" &&
      scarcityPromo >= 1 &&
      scarcityPromo <= 5;
    const showScarcityCatalog =
      !showScarcityPromo &&
      typeof scarcityCatalog === "number" &&
      scarcityCatalog >= 1 &&
      scarcityCatalog <= 5;

    if (showScarcityPromo || showScarcityCatalog) sync.scarcityLine = true;
    if (Boolean(product.showLowestPrice30dHint) && !product.soldOut) sync.lowest30Line = true;
  }

  return sync;
}

export function productAvailabilityText(product: ShopProduct, t: Translate): string {
  if (product.soldOut) return t("productAvailabilityUnavailable");
  const locationCount = Array.isArray(product.locations) ? product.locations.length : 0;
  if (locationCount > 1) {
    return t("productAvailabilityMultipleLocations").replace("{count}", String(locationCount));
  }
  if (locationCount === 1) return t("productAvailabilitySingleLocation");
  return t("productAvailabilityAvailable");
}

export function categoryHeroSubtitle(
  category: {
    name: string;
    tagline?: string | null;
    description?: string | null;
  },
  t: Translate,
): string {
  const categoryName = category.name.trim().toLowerCase();
  const tagline = (category.tagline ?? "").trim();
  const description = (category.description ?? "").trim();
  const taglineIsUseful = tagline.length > 0 && tagline.toLowerCase() !== categoryName;
  const descriptionIsUseful = description.length > 0 && description.toLowerCase() !== categoryName;
  if (taglineIsUseful) return tagline;
  if (descriptionIsUseful) return description;
  return t("categoryHeroSubtitle");
}
