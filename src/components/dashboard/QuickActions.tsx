import { useI18n } from "../../i18n";
import { useRouter } from "../Router";
import { canManageBilling, canPurchase } from "../../lib/platform";
import {
  DashboardIconBadge,
  IconBilling,
  IconFamily,
  IconServer,
  IconShop,
  IconSupport,
} from "./dashboard-icons";

export function QuickActions() {
  const { t } = useI18n();
  const { navigate } = useRouter();

  const actions = [
    { id: "servers", label: t("tabServers"), icon: <IconServer className="h-5 w-5" />, run: () => navigate({ name: "servers" }) },
    ...(canManageBilling()
      ? [{ id: "billing", label: t("quickBilling"), icon: <IconBilling className="h-5 w-5" />, run: () => navigate({ name: "invoices" }) }]
      : []),
    { id: "family", label: t("quickFamily"), icon: <IconFamily className="h-5 w-5" />, run: () => navigate({ name: "family" }) },
    ...(canPurchase()
      ? [{ id: "shop", label: t("quickShop"), icon: <IconShop className="h-5 w-5" />, run: () => navigate({ name: "shop" }) }]
      : []),
    { id: "support", label: t("quickSupport"), icon: <IconSupport className="h-5 w-5" />, run: () => navigate({ name: "support" }) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.run}
          className="glass glass-hover flex flex-col items-center justify-center gap-2.5 rounded-xl px-3 py-4 text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
        >
          <DashboardIconBadge className="size-10">{action.icon}</DashboardIconBadge>
          <span className="text-center text-xs font-medium leading-tight">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
