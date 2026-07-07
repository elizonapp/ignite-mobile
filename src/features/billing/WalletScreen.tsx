import { useMemo, useState } from "react";

import { useAuth } from "../../components/AuthProvider";
import { useAuth } from "../../components/AuthProvider";
import { useI18n } from "../../i18n";
import { cn } from "../../lib/utils";
import { canManageSavedPaymentMethodsUser } from "../../lib/saved-payment-methods";
import { AutoTopupTab } from "./tabs/AutoTopupTab";
import { BusinessFundTab } from "./tabs/BusinessFundTab";
import { InvoicesTab } from "./tabs/InvoicesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { PaymentMethodsTab } from "./tabs/PaymentMethodsTab";
import { SubscriptionsTab } from "./tabs/SubscriptionsTab";
import { VouchersTab } from "./tabs/VouchersTab";

type TabKey = "overview" | "subscriptions" | "invoices" | "methods" | "funding" | "fund";

export function WalletScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");

  const isBusiness = (user?.accountType ?? "").toUpperCase() === "BUSINESS";
  const showPaymentMethodsTab = canManageSavedPaymentMethodsUser(user);

  const tabs = useMemo(() => {
    const base: { key: TabKey; labelKey: string }[] = [
      { key: "overview", labelKey: "walletTabOverview" },
      { key: "subscriptions", labelKey: "walletTabSubscriptions" },
      { key: "invoices", labelKey: "walletTabInvoices" },
    ];
    if (showPaymentMethodsTab) {
      base.push({ key: "methods", labelKey: "walletTabMethods" });
    }
    base.push({ key: "funding", labelKey: "walletTabFunding" });
    if (isBusiness) base.push({ key: "fund", labelKey: "walletTabFund" });
    return base;
  }, [isBusiness, showPaymentMethodsTab]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-4 page-fullwidth">
      <div>
        <h1 className="text-2xl font-semibold text-(--text-primary)">{t("walletTitle")}</h1>
        <p className="text-sm text-(--text-muted)">{t("walletSubtitle")}</p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-(--border) pb-px">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === item.key
                ? "border-(--primary) text-(--text-primary)"
                : "border-transparent text-(--text-muted) hover:text-(--text-secondary)",
            )}
          >
            {t(item.labelKey as never)}
          </button>
        ))}
      </div>

      <div>
        {tab === "overview" && (
          <OverviewTab
            onNavigate={(next) => {
              if (next === "methods" && !showPaymentMethodsTab) return;
              setTab(next as TabKey);
            }}
            showPaymentMethods={showPaymentMethodsTab}
          />
        )}
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "methods" && <PaymentMethodsTab />}
        {tab === "funding" && (
          <div className="space-y-4">
            <AutoTopupTab />
            <VouchersTab />
          </div>
        )}
        {tab === "fund" && isBusiness && <BusinessFundTab />}
      </div>
    </div>
  );
}
