import { useAuth } from "../AuthProvider";
import { IconNetPoints, IconWallet } from "../dashboard/dashboard-icons";
import { useI18n } from "../../i18n";
import { isDesktopClient, isMobileNative } from "../../lib/platform";
import { CommandPaletteTrigger } from "./CommandPalette";

function formatEur(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function BalanceChip({
  label,
  value,
  tone,
  icon,
  title,
}: {
  label: string;
  value: string;
  tone: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-control border border-(--border) bg-(--bg-elevated) px-2.5 py-1.5"
      title={title}
    >
      <span className="text-(--text-muted)">{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="hidden text-[10px] font-medium uppercase tracking-wider text-(--text-muted) xl:block">
          {label}
        </div>
        <div className={`truncate text-xs font-semibold tabular-nums ${tone}`}>{value}</div>
      </div>
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const desktop = isDesktopClient();
  const mobileNative = isMobileNative();

  const balance = Number(user?.balance) || 0;
  const netPoints = Number(user?.netPointsBalance) || 0;

  return (
    <header className="glass-navbar app-header safe-top safe-x sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-(--border) px-4 py-2.5">
      {desktop ? (
        <div className="min-w-0 flex-1">
          <CommandPaletteTrigger className="w-full" />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-(--text-primary)">
            {mobileNative ? t("dashOverview") : t("appName")}
          </p>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        {user?.balance != null && (
          <BalanceChip
            label={t("billingBalance")}
            value={formatEur(balance, lang)}
            tone={balance >= 0 ? "text-(--success)" : "text-(--error)"}
            icon={<IconWallet className="h-3.5 w-3.5" />}
            title={t("billingBalance")}
          />
        )}
        {user?.netPointsBalance != null && (
          <BalanceChip
            label={t("netPoints")}
            value={`${netPoints} (${formatEur(netPoints * 0.01, lang)})`}
            tone="text-(--primary)"
            icon={<IconNetPoints className="h-3.5 w-3.5" />}
            title={t("netPoints")}
          />
        )}
      </div>
    </header>
  );
}
