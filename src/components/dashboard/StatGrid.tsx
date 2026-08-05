import { useI18n } from "../../i18n";
import { useRouter } from "../Router";
import type { DashboardStats } from "../../lib/types";
import { canManageBilling, canPurchase } from "../../lib/platform";
import {
  DashboardIconBadge,
  IconBilling,
  IconFamily,
  IconServer,
  IconShop,
  IconSupport,
} from "./dashboard-icons";

type StatCard = {
  id: string;
  label: string;
  value?: string;
  hint?: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export function StatGrid({ stats, isLoading = false }: { stats: DashboardStats; isLoading?: boolean }) {
  const { t } = useI18n();
  const { navigate } = useRouter();

  const items: StatCard[] = [
    {
      id: "servers",
      label: t("statTotalServers"),
      value: String(stats.totalServers),
      hint: `${t("statActiveServers")}: ${stats.activeServers}`,
      icon: <IconServer className="h-5 w-5" />,
      onClick: () => navigate({ name: "servers" }),
    },
    ...(canManageBilling()
      ? [
          {
            id: "billing",
            label: t("quickBilling"),
            value: `${stats.totalBandwidth} GB`,
            hint: t("statTotalBandwidth"),
            icon: <IconBilling className="h-5 w-5" />,
            onClick: () => navigate({ name: "invoices" }),
          } satisfies StatCard,
        ]
      : [
          {
            id: "family",
            label: t("quickFamily"),
            icon: <IconFamily className="h-5 w-5" />,
            onClick: () => navigate({ name: "family" }),
          } satisfies StatCard,
        ]),
    {
      id: "support",
      label: t("statOpenTickets"),
      value: String(stats.openTickets),
      hint: t("quickSupport"),
      icon: <IconSupport className="h-5 w-5" />,
      onClick: () => navigate({ name: "support" }),
    },
    ...(canPurchase()
      ? [
          {
            id: "shop",
            label: t("quickShop"),
            icon: <IconShop className="h-5 w-5" />,
            onClick: () => navigate({ name: "shop" }),
          } satisfies StatCard,
        ]
      : canManageBilling()
        ? [
            {
              id: "family",
              label: t("quickFamily"),
              icon: <IconFamily className="h-5 w-5" />,
              onClick: () => navigate({ name: "family" }),
            } satisfies StatCard,
          ]
        : []),
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass animate-pulse rounded-2xl p-4">
            <div className="h-3 w-20 rounded bg-(--surface-strong)" />
            <div className="mt-3 h-7 w-16 rounded bg-(--surface-strong)" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="glass glass-hover min-h-[5.5rem] rounded-2xl border border-(--border) p-4 text-left transition-all active:scale-[0.99] hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              {item.value != null ? (
                <>
                  <span className="text-xs font-medium text-(--text-muted)">{item.label}</span>
                  <p className="text-2xl font-semibold tabular-nums text-(--text-primary)">{item.value}</p>
                  {item.hint ? <p className="text-[11px] text-(--text-muted)">{item.hint}</p> : null}
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-(--text-primary)">{item.label}</p>
                  {item.hint ? <p className="text-[11px] text-(--text-muted)">{item.hint}</p> : null}
                </>
              )}
            </div>
            <DashboardIconBadge>{item.icon}</DashboardIconBadge>
          </div>
        </button>
      ))}
    </div>
  );
}
