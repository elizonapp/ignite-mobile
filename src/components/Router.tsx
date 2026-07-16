import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Route =
  | { name: "dashboard" }
  | { name: "servers" }
  | { name: "server"; id: string }
  | { name: "billing" }
  | { name: "elizon-plus" }
  | { name: "invoices" }
  | { name: "invoice-detail"; id: string }
  | { name: "invoice-pay"; id: string }
  | { name: "permission-accept"; permissionId: string }
  | { name: "support" }
  | { name: "settings"; view?: "id-verification" }
  | { name: "shop" }
  | { name: "shop-category"; categoryKey: string }
  | { name: "shop-product"; categoryKey: string; productSlug: string }
  | { name: "cart" }
  | { name: "checkout"; productId?: string; coupon?: string; ref?: string; offerToken?: string }
  | { name: "monthly-offers" }
  | { name: "storage" }
  | { name: "subdomains" }
  | { name: "domains" }
  | { name: "ip-manager" }
  | { name: "byoip" }
  | { name: "floating-ips" }
  | { name: "ssh-keys" }
  | { name: "affiliate" }
  | { name: "feedback" }
  | { name: "business" }
  | { name: "family" }
  | { name: "vroute" }
  | { name: "console"; id: string }
  | { name: "hosted-flow"; url: string; title?: string };

type RouterContextValue = {
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
  canGoBack: boolean;
};

const RouterContext = createContext<RouterContextValue | null>(null);

const TAB_ROUTES = new Set(["dashboard", "servers", "support", "settings"]);

export function RouterProvider({ initial = { name: "dashboard" }, children }: { initial?: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);

  const navigate = useCallback((route: Route) => {
    setStack((s) => [...s, route]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const value = useMemo<RouterContextValue>(() => {
    const current = stack[stack.length - 1] ?? { name: "dashboard" };
    return { route: current as Route, navigate, back, canGoBack: stack.length > 1 };
  }, [stack, navigate, back]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <RouterProvider>");
  return ctx;
}

export type NavTab = "dashboard" | "servers" | "support" | "settings";

export function useTab() {
  const { route, navigate } = useRouter();

  const tab: NavTab = (() => {
    if (route.name === "server" || route.name === "servers") return "servers";
    if (route.name === "support") return "support";
    if (route.name === "settings") return "settings";
    if (route.name === "dashboard") return "dashboard";
    return "dashboard";
  })();

  const setTab = useCallback(
    (next: NavTab) => navigate({ name: next }),
    [navigate],
  );

  return { tab, setTab };
}
