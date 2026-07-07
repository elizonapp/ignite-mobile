import { Sparkles, Wallet } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useI18n } from "../../../i18n";
import { cn } from "../../../lib/utils";
import { formatMoney } from "../lib";

type OverviewTabProps = {
  onNavigate: (tab: string) => void;
  showPaymentMethods?: boolean;
};

export function OverviewTab({ onNavigate, showPaymentMethods = true }: OverviewTabProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const balance = user?.balance ?? 0;
  const netPoints = user?.netPointsBalance ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass space-y-1 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-(--text-muted)">
            <Wallet className="size-4 text-(--elizon-primary)" />
            {t("billingBalance")}
          </div>
          <div className="text-2xl font-semibold text-(--text-primary)">{formatMoney(balance, lang)}</div>
          <button
            type="button"
            onClick={() => onNavigate("funding")}
            className="text-xs font-medium text-(--elizon-primary) hover:underline"
          >
            {t("overviewTopUp")}
          </button>
        </div>

        <div className="glass space-y-1 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-(--text-muted)">
            <Sparkles className="size-4 text-(--elizon-primary)" />
            {t("netPoints")}
          </div>
          <div className="text-2xl font-semibold text-(--text-primary)">
            {netPoints.toLocaleString(lang === "de" ? "de-DE" : "en-US")} {t("netPointsAbbrev")}
          </div>
          <p className="text-xs text-(--text-muted)">{t("overviewNetPointsHint")}</p>
        </div>
      </div>

      <div className={cn("grid gap-3", showPaymentMethods ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <QuickCard label={t("walletTabSubscriptions")} onClick={() => onNavigate("subscriptions")} />
        <QuickCard label={t("walletTabInvoices")} onClick={() => onNavigate("invoices")} />
        {showPaymentMethods && (
          <QuickCard label={t("walletTabMethods")} onClick={() => onNavigate("methods")} />
        )}
      </div>
    </div>
  );
}

function QuickCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass glass-hover rounded-xl p-4 text-left text-sm font-medium text-(--text-primary)"
    >
      {label}
    </button>
  );
}
