import { ShoppingCart } from "lucide-react";

import { BrandLogoLink } from "../BrandLogo";
import { useCart } from "../cart/CartProvider";
import { useAuth } from "../AuthProvider";
import { IconNetPoints, IconWallet } from "../dashboard/dashboard-icons";
import { useI18n } from "../../i18n";
import { canPurchase, isDesktopClient } from "../../lib/platform";
import { useRouter } from "../Router";
import { CommandPaletteTrigger } from "./CommandPalette";

function formatEur(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function BalanceChip({
  value,
  tone,
  icon,
  title,
}: {
  value: string;
  tone: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div
      className="flex h-10 items-center gap-2 rounded-control border border-(--border) bg-(--bg-elevated) px-3"
      title={title}
    >
      <span className="shrink-0 text-(--text-muted)">{icon}</span>
      <div className={`min-w-0 truncate text-xs font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { navigate } = useRouter();
  const { itemCount } = useCart();
  const desktop = isDesktopClient();
  const showCart = canPurchase();

  const balance = Number(user?.balance) || 0;
  const netPoints = Number(user?.netPointsBalance) || 0;

  return (
    <header className="glass-navbar app-header safe-top safe-x sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-(--border) px-4 py-2.5">
      {desktop ? (
        <div className="min-w-0 flex-1">
          <CommandPaletteTrigger className="h-10 w-full" />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <BrandLogoLink
            width={96}
            height={72}
            alt="elizon"
            onClick={() => navigate({ name: "dashboard" })}
            className="h-9 w-auto justify-start"
          />
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        {showCart && (
          <button
            type="button"
            onClick={() => navigate({ name: "cart" })}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-control border border-(--border) bg-(--bg-elevated) text-(--text-secondary) hover:text-(--text-primary)"
            title={t("navCart")}
            aria-label={t("navCart")}
          >
            <ShoppingCart className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-(--elizon-primary) px-1 text-[10px] font-bold leading-4 text-white">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </button>
        )}
        {user?.balance != null && (
          <BalanceChip
            value={formatEur(balance, lang)}
            tone={balance >= 0 ? "text-(--success)" : "text-(--error)"}
            icon={<IconWallet className="size-4" />}
            title={t("billingBalance")}
          />
        )}
        {user?.netPointsBalance != null && (
          <BalanceChip
            value={`${netPoints} (${formatEur(netPoints * 0.01, lang)})`}
            tone="text-(--primary)"
            icon={<IconNetPoints className="size-4" />}
            title={t("netPoints")}
          />
        )}
      </div>
    </header>
  );
}
