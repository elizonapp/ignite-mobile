export type TrafficPricingBlock = { upToTb: number | null; pricePerTbGross: number };

const DEFAULT_PREVIEW_BLOCKS: TrafficPricingBlock[] = [
  { upToTb: 5, pricePerTbGross: 3 },
  { upToTb: 10, pricePerTbGross: 2.5 },
  { upToTb: 25, pricePerTbGross: 2 },
  { upToTb: 50, pricePerTbGross: 1.75 },
  { upToTb: null, pricePerTbGross: 1.5 },
];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateExtraTbCostFromBlocks(addonTb: number, blocks: TrafficPricingBlock[]): number {
  const tb = Math.max(0, Math.ceil(addonTb || 0));
  if (tb <= 0 || blocks.length === 0) return 0;

  let remaining = tb;
  let consumed = 0;
  let cost = 0;

  for (const block of blocks) {
    const blockMax = block.upToTb == null ? Number.POSITIVE_INFINITY : Number(block.upToTb);
    const blockSize = Number.isFinite(blockMax) ? Math.max(0, blockMax - consumed) : remaining;
    if (blockSize <= 0) continue;
    const take = Math.min(blockSize, remaining);
    cost += take * Number(block.pricePerTbGross);
    consumed += take;
    remaining -= take;
    if (remaining <= 0) break;
  }

  return roundMoney(cost);
}

export function calculateTrafficAddonPrice(addonTb: number, blocks?: TrafficPricingBlock[]): number {
  const effectiveBlocks = Array.isArray(blocks) && blocks.length > 0 ? blocks : DEFAULT_PREVIEW_BLOCKS;
  return calculateExtraTbCostFromBlocks(addonTb, effectiveBlocks);
}
