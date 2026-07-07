import type { ComponentType } from "react";
import { Puzzle } from "lucide-react";

import { useProviderT } from "./use-provider-t";
import ResourceUsageWidget from "./widgets/ResourceUsageWidget";
import IpAddressesWidget from "./widgets/IpAddressesWidget";
import ConsoleWidget from "./widgets/ConsoleWidget";
import type { ProviderWidgetContext, ProviderWidgetProps, WidgetSlot } from "./types";

/**
 * Mobile widget component map. Ports the widgets that make sense on mobile
 * (resource usage, IPs, console); the desktop-heavy ones (file manager,
 * backups, firewall, upgrade, mailcow, …) fall back to an unavailable notice
 * so the schema still drives the layout without pulling desktop-only deps.
 */
const WIDGET_COMPONENTS: Record<string, ComponentType<ProviderWidgetProps>> = {
  "resource-usage": ResourceUsageWidget,
  "ip-addresses": IpAddressesWidget,
  "game-network": IpAddressesWidget,
  "console-vnc": ConsoleWidget,
  "console-terminal": ConsoleWidget,
};

function UnavailableWidget({ widgetId }: { widgetId: string }) {
  const t = useProviderT();
  return (
    <section className="glass p-4">
      <div className="flex items-center gap-2">
        <Puzzle className="size-5 shrink-0 text-(--text-muted)" />
        <h3 className="text-sm font-medium text-(--text-primary)">{widgetId}</h3>
      </div>
      <p className="mt-1.5 text-xs text-(--text-muted)">{t("providerWidgetUnavailable")}</p>
    </section>
  );
}

export function ProviderWidgetHost({
  slots,
  serviceId,
  context,
  className,
}: {
  slots: WidgetSlot[];
  serviceId?: string;
  context?: ProviderWidgetContext;
  className?: string;
}) {
  if (slots.length === 0) return null;

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {slots.map((slot, index) => {
        const Widget = WIDGET_COMPONENTS[slot.widget];
        const key = `${slot.widget}-${index}`;
        if (!Widget) return <UnavailableWidget key={key} widgetId={slot.widget} />;
        return <Widget key={key} slot={slot} serviceId={serviceId} context={context} />;
      })}
    </div>
  );
}
