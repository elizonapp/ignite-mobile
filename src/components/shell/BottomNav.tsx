import { useEffect, useState } from "react";
import { LayoutDashboard, MessageSquare, Server, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useI18n } from "../../i18n";
import { cn } from "../../lib/utils";
import type { NavTab } from "../Router";

type Item = {
  id: NavTab;
  labelKey: "tabHome" | "tabServers" | "tabSupport" | "tabSettings";
  icon: LucideIcon;
};

const items: Item[] = [
  { id: "dashboard", labelKey: "tabHome", icon: LayoutDashboard },
  { id: "servers", labelKey: "tabServers", icon: Server },
  { id: "support", labelKey: "tabSupport", icon: MessageSquare },
  { id: "settings", labelKey: "tabSettings", icon: Settings },
];

export function BottomNav({ active, onChange }: { active: NavTab; onChange: (tab: NavTab) => void }) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("navPrimary")}
      className="glass-navbar safe-bottom safe-x sticky bottom-0 z-30 mt-auto border-t border-(--border)"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-(--primary)" : "text-(--text-muted)",
                )}
              >
                <item.icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
                {t(item.labelKey)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
