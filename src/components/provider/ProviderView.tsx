import { useMemo, useState } from "react";

import { canManageBilling } from "../../lib/platform";
import { useProviderT } from "./use-provider-t";
import { ProviderActionBar } from "./ProviderActionBar";
import { ProviderFieldGrid } from "./ProviderFieldGrid";
import { ProviderWidgetHost } from "./ProviderWidgetHost";
import { ServiceBillingPanel } from "./ServiceBillingPanel";
import { hasResolvedFieldDisplayValue } from "./format-field";
import type {
  ActionDispatchResponse,
  ProviderView as ProviderViewModel,
  ProviderViewAccess,
  ProviderWidgetContext,
  SectionDef,
  TabDef,
  WidgetSlot,
} from "./types";

const ADVANCED_TAB_ID = "__advanced";
const BILLING_TAB_ID = "billing";

function pickWidgets(defined: WidgetSlot[] | undefined, allowed: Map<string, WidgetSlot>): WidgetSlot[] {
  if (!defined) return [];
  return defined
    .map((slot) => allowed.get(slot.widget))
    .filter((slot): slot is WidgetSlot => Boolean(slot));
}

type Props = {
  view: ProviderViewModel;
  serviceId: string;
  resourceName?: string;
  /** From GET /api/services/:id (server.access). Controls the billing tab. */
  access?: ProviderViewAccess | null;
  widgetContext?: ProviderWidgetContext;
  onActionCompleted?: (actionKey: string, result: ActionDispatchResponse) => void;
  /** Navigate to the dedicated billing area (desktop only). */
  onOpenBilling?: () => void;
  onRefresh?: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToInvoiceDetail?: (invoiceId: string) => void;
  onNavigateToInvoicePay?: (invoiceId: string) => void;
};

/**
 * Mobile schema-driven provider surface. Renders header (Tier-1) actions,
 * Ebene-1 sections, an Ebene-2 tab rail and Ebene-3 behind an "Erweitert" tab
 * (AGENTS.md §3.1). The billing tab is hidden unless the client may manage
 * billing (native mobile never can) and the backend grants access.
 */
export function ProviderView({
  view,
  serviceId,
  resourceName,
  access,
  widgetContext,
  onActionCompleted,
  onOpenBilling,
  onRefresh,
  onNavigateToInvoices,
  onNavigateToInvoiceDetail,
  onNavigateToInvoicePay,
}: Props) {
  const t = useProviderT();
  const { layout } = view;

  const billingAllowed = canManageBilling() && access?.canManageBilling !== false;

  const allowedWidgets = useMemo(() => {
    const map = new Map<string, WidgetSlot>();
    for (const slot of view.widgets) {
      if (!map.has(slot.widget)) map.set(slot.widget, slot);
    }
    return map;
  }, [view.widgets]);

  const actionsByKey = useMemo(() => new Map(view.actions.map((a) => [a.key, a])), [view.actions]);
  const fieldsByKey = useMemo(() => new Map(view.fields.map((f) => [f.key, f])), [view.fields]);

  const headerActions = useMemo(() => {
    const keys = (layout.header ?? []).flatMap((slot) => slot.actions ?? []);
    return keys.map((key) => actionsByKey.get(key)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [layout.header, actionsByKey]);

  const visibleTabs = useMemo(() => {
    const tabs = (view.tabs ?? []).filter((tab) => {
      // Billing tab is hidden on native / when the backend denies billing.
      if (tab.id === BILLING_TAB_ID && !billingAllowed) return false;

      const hasFields = (tab.fields?.length ?? 0) > 0;
      const hasActions = (tab.actions?.length ?? 0) > 0;
      const definesWidgets = (tab.widgets?.length ?? 0) > 0;
      if (!definesWidgets) return true;
      const surviving = pickWidgets(tab.widgets, allowedWidgets);
      return surviving.length > 0 || hasFields || hasActions;
    });

    if ((layout.advanced?.length ?? 0) > 0) {
      tabs.push({ id: ADVANCED_TAB_ID, labelKey: "providerTabAdvanced", tier: 3 });
    }
    return tabs;
  }, [view.tabs, layout.advanced, allowedWidgets, billingAllowed]);

  const [activeKey, setActiveKey] = useState<string>("");
  const activeTab = visibleTabs.find((tab) => tab.id === activeKey) ?? visibleTabs[0];

  const renderSection = (section: SectionDef) => {
    const sectionFields = (section.fields ?? [])
      .map((key) => fieldsByKey.get(key))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      .filter((f) => hasResolvedFieldDisplayValue(f));
    const sectionWidgets = pickWidgets(
      [...(section.widgets ?? []), ...(section.slots ?? []).flatMap((s) => s.widgets ?? [])],
      allowedWidgets,
    );

    if (sectionFields.length === 0 && sectionWidgets.length === 0) return null;

    return (
      <section key={section.id} className="space-y-3">
        {section.labelKey ? (
          <h2 className="text-sm font-semibold text-(--text-primary)">{t(section.labelKey)}</h2>
        ) : null}
        {sectionFields.length > 0 ? <ProviderFieldGrid fields={sectionFields} /> : null}
        {sectionWidgets.length > 0 ? (
          <ProviderWidgetHost slots={sectionWidgets} serviceId={serviceId} context={widgetContext} />
        ) : null}
      </section>
    );
  };

  const renderTabBody = (tab: TabDef) => {
    if (tab.id === BILLING_TAB_ID) {
      return (
        <ServiceBillingPanel
          serviceId={serviceId}
          serviceName={resourceName ?? serviceId}
          onRefresh={onRefresh}
          onNavigateToInvoices={onNavigateToInvoices ?? onOpenBilling}
          onNavigateToInvoiceDetail={onNavigateToInvoiceDetail}
          onNavigateToInvoicePay={onNavigateToInvoicePay}
        />
      );
    }

    if (tab.id === ADVANCED_TAB_ID) {
      return <div className="space-y-4">{(layout.advanced ?? []).map((section) => renderSection(section))}</div>;
    }

    const matchingSections = (layout.sections ?? []).filter((s) => s.id === tab.id);
    const tabFields = (tab.fields ?? [])
      .map((key) => fieldsByKey.get(key))
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    const tabActions = (tab.actions ?? [])
      .map((key) => actionsByKey.get(key))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    const tabWidgets = pickWidgets(tab.widgets, allowedWidgets);

    const hasContent =
      matchingSections.length > 0 || tabFields.length > 0 || tabActions.length > 0 || tabWidgets.length > 0;

    if (!hasContent) {
      return <div className="glass p-6 text-sm text-(--text-muted)">{t("providerTabEmpty")}</div>;
    }

    return (
      <div className="space-y-4">
        {matchingSections.map((section) => renderSection(section))}
        {matchingSections.length === 0 && tabFields.length > 0 ? <ProviderFieldGrid fields={tabFields} /> : null}
        {tabActions.length > 0 ? (
          <ProviderActionBar
            serviceId={serviceId}
            actions={tabActions}
            resourceName={resourceName}
            onCompleted={onActionCompleted}
          />
        ) : null}
        {tabWidgets.length > 0 ? (
          <ProviderWidgetHost slots={tabWidgets} serviceId={serviceId} context={widgetContext} />
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {headerActions.length > 0 ? (
        <ProviderActionBar
          serviceId={serviceId}
          actions={headerActions}
          resourceName={resourceName}
          onCompleted={onActionCompleted}
        />
      ) : null}

      {visibleTabs.length > 1 && activeTab ? (
        <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {visibleTabs.map((tab) => {
            const active = activeTab.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveKey(tab.id)}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-(--elizon-primary) text-white"
                    : "glass text-(--text-secondary) hover:text-(--text-primary)"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>
      ) : null}

      {activeTab ? (
        renderTabBody(activeTab)
      ) : (
        <div className="space-y-4">{(layout.sections ?? []).map((section) => renderSection(section))}</div>
      )}
    </div>
  );
}
