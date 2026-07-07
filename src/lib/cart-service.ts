export type CartCustomization = {
  vcores?: number;
  memory?: number;
  storage?: number;
  bandwidth?: number;
  speedGbit?: number;
};

export type CartItem = {
  lineId: string;
  productId: string;
  productSlug: string;
  productName: string;
  categoryId: string;
  categoryName?: string;
  quantity: number;
  billingCycle: number;
  priceMonthly: number;
  priceYearly?: number | null;
  itemType: "new";
  locationId?: string;
  customization?: CartCustomization;
  customizationPrices?: Record<string, number | undefined>;
  configuredSpecs?: { vcores: number; memory: number; storage: number };
  resourceSpecsUnit?: "mb";
  billingOptions?: {
    billingDiscountPerMonth?: number;
    billingSurcharge7d?: number;
    billingSurcharge14d?: number;
  };
  setupFee?: number;
};

function itemMergeKey(item: Omit<CartItem, "lineId">): string {
  return JSON.stringify({
    productId: item.productId,
    billingCycle: item.billingCycle,
    locationId: item.locationId ?? null,
    customization: item.customization ?? null,
  });
}

export type Cart = {
  items: CartItem[];
};

const STORAGE_KEY = "elizon_cart";
const CART_EVENT = "elizon-cart-changed";

function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readCart(): Cart {
  if (typeof localStorage === "undefined") return { items: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw) as Cart;
    return {
      items: (parsed.items ?? []).map((item) =>
        item.lineId ? item : { ...item, lineId: generateLineId() },
      ),
    };
  } catch {
    return { items: [] };
  }
}

function writeCart(cart: Cart): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

function mergeNewItem(cart: Cart, item: Omit<CartItem, "lineId">): Cart {
  const mergeKey = itemMergeKey(item);
  const existingIndex = cart.items.findIndex(
    (entry) => entry.itemType === "new" && itemMergeKey(entry) === mergeKey,
  );

  if (existingIndex >= 0) {
    const next = [...cart.items];
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: next[existingIndex].quantity + item.quantity,
    };
    return { items: next };
  }

  return {
    items: [...cart.items, { ...item, lineId: generateLineId() }],
  };
}

export const cartService = {
  getCart(): Cart {
    return readCart();
  },

  getItemCount(): number {
    return readCart().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  addItem(item: Omit<CartItem, "lineId">): Cart {
    const cart = mergeNewItem(readCart(), item);
    writeCart(cart);
    return cart;
  },

  removeItem(lineId: string): Cart {
    const cart = { items: readCart().items.filter((item) => item.lineId !== lineId) };
    writeCart(cart);
    return cart;
  },

  updateQuantity(lineId: string, quantity: number): Cart {
    const cart = readCart();
    const next = cart.items.map((item) =>
      item.lineId === lineId ? { ...item, quantity: Math.max(1, quantity) } : item,
    );
    writeCart({ items: next });
    return { items: next };
  },

  updateBillingCycle(lineId: string, billingCycle: number): Cart {
    const cart = readCart();
    const target = cart.items.find((item) => item.lineId === lineId);
    if (!target) return cart;

    const withoutTarget = cart.items.filter((item) => item.lineId !== lineId);
    const targetKey = itemMergeKey({ ...target, billingCycle });
    const duplicate = withoutTarget.find((item) => itemMergeKey(item) === targetKey);

    if (duplicate) {
      const next = withoutTarget.map((item) =>
        item.lineId === duplicate.lineId
          ? { ...item, quantity: item.quantity + target.quantity }
          : item,
      );
      writeCart({ items: next });
      return { items: next };
    }

    const next = cart.items.map((item) =>
      item.lineId === lineId ? { ...item, billingCycle } : item,
    );
    writeCart({ items: next });
    return { items: next };
  },

  clearCart(): Cart {
    const empty = { items: [] };
    writeCart(empty);
    return empty;
  },

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    window.addEventListener(CART_EVENT, handler);
    return () => window.removeEventListener(CART_EVENT, handler);
  },
};
