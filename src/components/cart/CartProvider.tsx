import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { cartService, type Cart, type CartItem } from "../../lib/cart-service";

type CartContextValue = {
  cart: Cart;
  itemCount: number;
  addItem: (item: Omit<CartItem, "lineId">) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateBillingCycle: (lineId: string, billingCycle: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => cartService.getCart());

  useEffect(() => cartService.subscribe(() => setCart(cartService.getCart())), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      addItem: (item) => {
        cartService.addItem(item);
      },
      removeItem: (lineId) => {
        cartService.removeItem(lineId);
      },
      updateQuantity: (lineId, quantity) => {
        cartService.updateQuantity(lineId, quantity);
      },
      updateBillingCycle: (lineId, billingCycle) => {
        cartService.updateBillingCycle(lineId, billingCycle);
      },
      clearCart: () => {
        cartService.clearCart();
      },
    }),
    [cart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
