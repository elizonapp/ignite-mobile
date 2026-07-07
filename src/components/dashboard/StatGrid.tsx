import { useI18n } from "../../i18n";
import type { DashboardStats } from "../../lib/types";
import {
  DashboardIconBadge,
  IconChart,
  IconCpu,
  IconServer,
  IconSupport,
} from "./dashboard-icons";

type StatItem = {
  key: keyof DashboardStats;
  label: string;
  value: string;
  icon: React.ReactNode;
};

export function StatGrid({ stats, isLoading = false }: { stats: DashboardStats; isLoading?: boolean }) {
  const { t } = useI18n();
  const items: StatItem[] = [
    {
      key: "totalServers",
      label: t("statTotalServers"),
      value: String(stats.totalServers),
      icon: <IconServer className="h-5 w-5" />,
    },
    {
      key: "activeServers",
      label: t("statActiveServers"),
      value: String(stats.activeServers),
      icon: <IconCpu className="h-5 w-5" />,
    },
    {
      key: "totalBandwidth",
      label: t("statTotalBandwidth"),
      value: `${stats.totalBandwidth} GB`,
      icon: <IconChart className="h-5 w-5" />,
    },
    {
      key: "openTickets",
      label: t("statOpenTickets"),
      value: String(stats.openTickets),
      icon: <IconSupport className="h-5 w-5" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="glass glass-hover rounded-2xl border border-(--border) p-4 transition-all hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <span className="text-xs font-medium text-(--text-muted)">{item.label}</span>
              <p className="text-2xl font-semibold tabular-nums text-(--text-primary)">{item.value}</p>
            </div>
            <DashboardIconBadge>{item.icon}</DashboardIconBadge>
          </div>
        </div>
      ))}
    </div>
  );
}
