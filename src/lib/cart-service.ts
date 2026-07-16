export type CartCustomization = {
  vcores?: number;
  memory?: number;
  storage?: number;
  bandwidth?: number;
  speedGbit?: number;
  maxDomains?: number;
  maxMailboxesPerDomain?: number;
  storagePerMailboxGb?: number;
  maxAliasesPerDomain?: number;
};

export type CartItemType = "new" | "renewal" | "upgrade";

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
  itemType: CartItemType;
  serviceId?: string;
  subscriptionId?: string;
  daysExtension?: number;
  locationId?: string;
  templateId?: number;
  additionalIPv4?: number;
  additionalIPv6?: number;
  includeIPv4?: boolean;
  includeIPv6?: boolean;
  sshKeyIds?: string[];
  eggId?: number;
  nestId?: number;
  dockerImage?: string;
  environment?: Record<string, string>;
  providerVariables?: Record<string, string>;
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
  billingMode?: "PREPAID" | "CONTRACT";
  contractTermMonths?: number;
};

function itemMergeKey(item: Omit<CartItem, "lineId">): string {
  return JSON.stringify({
    productId: item.productId,
    billingCycle: item.billingCycle,
    locationId: item.locationId ?? null,
    templateId: item.templateId ?? null,
    eggId: item.eggId ?? null,
    dockerImage: item.dockerImage ?? null,
    additionalIPv4: item.additionalIPv4 ?? 0,
    additionalIPv6: item.additionalIPv6 ?? 0,
    includeIPv4: item.includeIPv4 ?? true,
    includeIPv6: item.includeIPv6 ?? true,
    sshKeyIds: item.sshKeyIds ?? [],
    environment: item.environment ?? null,
    providerVariables: item.providerVariables ?? null,
    customization: item.customization ?? null,
    configuredSpecs: item.configuredSpecs ?? null,
    billingMode: item.billingMode ?? "PREPAID",
    contractTermMonths: item.contractTermMonths ?? null,
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
      items: (parsed.items ?? []).map((item) => ({
        ...(item.lineId ? item : { ...item, lineId: generateLineId() }),
        itemType: item.itemType ?? "new",
      })),
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
  const itemType = item.itemType ?? "new";

  if ((itemType === "renewal" || itemType === "upgrade") && item.serviceId) {
    const existingIndex = cart.items.findIndex(
      (entry) =>
        (entry.itemType === "renewal" || entry.itemType === "upgrade") &&
        entry.serviceId === item.serviceId,
    );
    const lineId = existingIndex >= 0 ? cart.items[existingIndex]!.lineId : `renewal-${item.serviceId}`;
    const newItem: CartItem = { ...item, itemType, lineId };
    if (existingIndex >= 0) {
      const next = [...cart.items];
      next[existingIndex] = newItem;
      return { items: next };
    }
    return { items: [...cart.items, newItem] };
  }

  const mergeKey = itemMergeKey(item);
  const existingIndex = cart.items.findIndex(
    (entry) => entry.itemType === "new" && itemMergeKey(entry) === mergeKey,
  );

  if (existingIndex >= 0) {
    const existing = cart.items[existingIndex];
    if (!existing) return cart;
    const next = [...cart.items];
    next[existingIndex] = {
      ...existing,
      quantity: existing.quantity + item.quantity,
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

  removeByServiceId(serviceId: string): Cart {
    const cart = {
      items: readCart().items.filter(
        (item) =>
          !(
            (item.itemType === "renewal" || item.itemType === "upgrade") &&
            item.serviceId === serviceId
          ),
      ),
    };
    writeCart(cart);
    return cart;
  },

  updateQuantity(lineId: string, quantity: number): Cart {
    const cart = {
      items: readCart().items.map((item) =>
        item.lineId === lineId ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    };
    writeCart(cart);
    return cart;
  },

  updateBillingCycle(lineId: string, billingCycle: number): Cart {
    const cart = {
      items: readCart().items.map((item) =>
        item.lineId === lineId ? { ...item, billingCycle } : item,
      ),
    };
    writeCart(cart);
    return cart;
  },

  clearCart(): Cart {
    const cart = { items: [] as CartItem[] };
    writeCart(cart);
    return cart;
  },

  clear(): Cart {
    return this.clearCart();
  },

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    window.addEventListener(CART_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CART_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  },
};

export { CART_EVENT };
