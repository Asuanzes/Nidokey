import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  notes?: string | null;
};

type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartLine[];
};

type CartContextValue = CartState & {
  count: number;
  totalCents: number;
  clear: () => void;
  setRestaurant: (restaurantId: string, restaurantName: string) => void;
  addItem: (restaurantId: string, restaurantName: string, item: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function FoodCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ restaurantId: null, restaurantName: null, items: [] });

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCents = state.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    return {
      ...state,
      count,
      totalCents,
      clear: () => setState({ restaurantId: null, restaurantName: null, items: [] }),
      setRestaurant: (restaurantId, restaurantName) => setState({ restaurantId, restaurantName, items: [] }),
      addItem: (restaurantId, restaurantName, item, quantity = 1) =>
        setState((prev) => {
          const sameRestaurant = prev.restaurantId === restaurantId || prev.items.length === 0;
          const base = sameRestaurant ? prev.items : [];
          const idx = base.findIndex((line) => line.menuItemId === item.menuItemId);
          const next = [...base];
          if (idx >= 0) {
            next[idx] = { ...next[idx], quantity: Math.min(20, next[idx].quantity + quantity) };
          } else {
            next.push({ ...item, quantity: Math.max(1, Math.min(20, quantity)) });
          }
          return { restaurantId, restaurantName, items: next };
        }),
      updateQuantity: (menuItemId, quantity) =>
        setState((prev) => ({
          ...prev,
          items: prev.items
            .map((item) => (item.menuItemId === menuItemId ? { ...item, quantity: Math.max(0, Math.min(20, quantity)) } : item))
            .filter((item) => item.quantity > 0),
        })),
      updateNotes: (menuItemId, notes) =>
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) => (item.menuItemId === menuItemId ? { ...item, notes } : item)),
        })),
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useFoodCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useFoodCart fuera de FoodCartProvider");
  return ctx;
}
