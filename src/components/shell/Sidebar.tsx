import { useEffect, useState } from "react";
import {
  Briefcase,
  HardDrive,
  Key,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Server,
  Settings,
  ShoppingBag,
  Star,
  Users,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "../AuthProvider";
import { useI18n } from "../../i18n";
import { api } from "../../lib/api";
import { canAccessWallet, canManageBilling } from "../../lib/platform";
import { cn } from "../../lib/utils";
import { formatUserGreetingName } from "../../lib/userName";
import type { Route } from "../Router";

type SidebarRouteName = Exclude<Route["name"], "server" | "invoice-pay" | "permission-accept" | "console">;
type SidebarRoute = Extract<Route, { name: SidebarRouteName }>;

type NavItem = {
  label: string;
  route: SidebarRouteName;
  icon: LucideIcon;
  badge?: number;
  beta?: boolean;
};

const mainNav: Omit<NavItem, "label">[] = [
  { route: "dashboard", icon: LayoutDashboard },
  { route: "servers", icon: Server },
  { route: "vroute", icon: Globe, beta: true },
  { route: "storage", icon: HardDrive, beta: true },
  { route: "subdomains", icon: Globe },
  { route: "domains", icon: Globe },
  { route: "ip-manager", icon: Key },
  { route: "byoip", icon: Globe },
  { route: "floating-ips", icon: Globe },
  { route: "ssh-keys", icon: Key },
];

/* Reihenfolge synchron zum Web-Dashboard (DashboardLayoutClient) */
const secondaryNav: Omit<NavItem, "label">[] = [
  { route: "billing", icon: Receipt },
  { route: "business", icon: Briefcase },
  { route: "support", icon: MessageSquare },
  { route: "feedback", icon: Star },
  { route: "family", icon: Users },
  { route: "settings", icon: Settings },
  { route: "shop", icon: ShoppingBag },
];

const labelMap: Partial<Record<SidebarRouteName, string>> = {
  dashboard: "tabHome",
  servers: "tabServers",
  billing: "tabBilling",
  invoices: "tabBilling",
  support: "tabSupport",
  settings: "tabSettings",
  shop: "tabShop",
  storage: "storageTitle",
  subdomains: "subdomainTitle",
  domains: "domainsTitle",
  "ip-manager": "ipManagerTitle",
  byoip: "byoipTitle",
  "floating-ips": "floatingIpTitle",
  "ssh-keys": "sshKeys",
  affiliate: "affiliateTitle",
  feedback: "feedbackTitle",
  business: "businessTitle",
  family: "familyTitle",
  vroute: "vrouteTitle",
};

function getLabel(route: SidebarRouteName, t: (key: string) => string) {
  const key = labelMap[route];
  return key ? t(key) : route;
}

function normalizeRouteName(route: Route["name"]): Route["name"] {
  if (route === "server") return "servers";
  if (route === "invoices" || route === "invoice-pay") return "billing";
  return route;
}

export function Sidebar({ routeName, navigate }: { routeName: Route["name"]; navigate: (route: Route) => void }) {
  const { t } = useI18n();
  const tAny = t as (key: string) => string;
  const { user } = useAuth();
  const [isAffiliate, setIsAffiliate] = useState(false);
  const activeRoute = normalizeRouteName(routeName);

  useEffect(() => {
    api.affiliates
      .me()
      .then((d) => setIsAffiliate(d.success))
      .catch(() => setIsAffiliate(false));
  }, []);

  const mainItems: NavItem[] = mainNav.map((item) => ({
    ...item,
    label: getLabel(item.route, tAny),
  }));

  const secondaryItems: NavItem[] = secondaryNav
    .filter(
      (item) =>
        (item.route !== "shop" || canPurchase()) &&
        (item.route !== "billing" || canAccessWallet()) &&
        (item.route !== "business" || ["business", "BUSINESS"].includes(user?.accountType ?? "")),
    )
    .map((item) => ({
      ...item,
      label: getLabel(item.route, tAny),
    }));

  if (isAffiliate && !secondaryItems.some((item) => item.route === "affiliate")) {
    // Wie im Web: Affiliate direkt vor "Einstellungen" einsortieren
    const settingsIndex = secondaryItems.findIndex((item) => item.route === "settings");
    secondaryItems.splice(settingsIndex === -1 ? secondaryItems.length : settingsIndex, 0, {
      route: "affiliate",
      icon: Users,
      label: getLabel("affiliate", tAny),
    });
  }

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-(--border) lg:bg-(--bg-base)">
      <div className="flex h-full flex-col">
        <div className="glass-navbar border-b border-(--border) p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[var(--radius-surface)] bg-(--primary) text-white shadow-sm">
              <span className="text-lg font-semibold">E</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-(--text-primary)">elizon</p>
              <p className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">{t("appDashboardLabel")}</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-(--text-muted)">{tAny("navServices")}</div>
          {mainItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate({ name: item.route } as SidebarRoute)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-(--primary)/10 text-(--primary)"
                    : "text-(--text-secondary) hover:bg-(--surface-soft) hover:text-(--text-primary)",
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-(--primary)" : "text-(--text-muted)")} />
                <span className="truncate">{item.label}</span>
                {item.beta && (
                  <span className="ml-auto inline-flex items-center rounded-[var(--radius-action)] bg-(--primary)/20 px-2 py-0.5 text-[10px] font-semibold text-(--primary)">
                    {tAny("betaBadge")}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mb-2 mt-6 px-3 text-xs font-medium uppercase tracking-wider text-(--text-muted)">{tAny("navAccount")}</div>
          {secondaryItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate({ name: item.route } as SidebarRoute)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-(--primary)/10 text-(--primary)"
                    : "text-(--text-secondary) hover:bg-(--surface-soft) hover:text-(--text-primary)",
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-(--primary)" : "text-(--text-muted)")} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-(--border) p-4">
          <div className="glass flex items-center gap-3 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-surface)] bg-(--primary)/10 text-(--primary)">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-(--text-primary)">
                {user
                  ? formatUserGreetingName(user) ||
                    (typeof user.email === "string" ? user.email.split("@")[0] : tAny("defaultUserName"))
                  : tAny("defaultUserName")}
              </div>
              <div className="truncate text-xs text-(--text-muted)">
                {typeof user?.email === "string" ? user.email : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
