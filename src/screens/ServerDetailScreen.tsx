import { ChevronLeft, Globe2, MapPin, RefreshCcw, Server as ServerIcon, TriangleAlert } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useRouter } from "../components/Router";
import { ProviderView } from "../components/provider";
import { ServicePendingActionBanner } from "../components/provider/ServiceBillingPanel";
import { useI18n } from "../i18n";
import { useServiceDetail } from "../hooks/useServiceDetail";
import { useProviderView } from "../hooks/useProviderView";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { formatMoney } from "../features/billing/lib";
import type { DashboardServer, ServerStatus } from "../lib/types";
import type { ProviderViewIdentity } from "../components/provider";
import { useCallback, useEffect, useState } from "react";

const dotClass: Record<ServerStatus, string> = {
  online: "bg-(--success)",
  offline: "bg-(--text-muted)",
  starting: "bg-(--warning) animate-pulse",
  stopping: "bg-(--warning) animate-pulse",
};

export function ServerDetailScreen({ id }: { id: string }) {
  const { t } = useI18n();
  const { back, navigate } = useRouter();
  const { server, network, access, isLoading, refresh } = useServiceDetail(id);
  const { view, loading: viewLoading, error: viewError, refetch: refetchView } = useProviderView(id);

  const identity = view?.identity ?? null;
  const title = identity?.displayName || identity?.name || server?.name || t("loading");

  const handleActionCompleted = () => {
    void refresh(true);
  };

  const reloadAll = () => {
    void refresh();
    void refetchView();
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <header className="safe-top safe-x flex items-center gap-2 pb-3 pt-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("back")}
          onClick={back}
          className="h-10 w-10 rounded-full text-(--text-secondary) hover:bg-(--surface-soft)"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-(--text-primary)">{title}</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("refresh")}
          onClick={reloadAll}
          className="h-10 w-10 rounded-full text-(--text-secondary) hover:bg-(--surface-soft)"
        >
          <RefreshCcw className="size-4" />
        </Button>
      </header>

      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <IdentityCard server={server} identity={identity} />

        {server?.terminationPending || server?.reinstallPending ? (
          <ServicePendingActionBanner
            terminationPending={server.terminationPending}
            reinstallPending={server.reinstallPending}
          />
        ) : null}

        {server?.suspendedAt && server.suspendReason === "Payment overdue" && access?.canManageBilling !== false ? (
          <PaymentOverdueBanner
            serviceId={id}
            onPayInvoice={(invoiceId) => navigate({ name: "invoice-pay", id: invoiceId })}
            onViewInvoice={(invoiceId) => navigate({ name: "invoice-detail", id: invoiceId })}
          />
        ) : null}

        {viewLoading ? (
          <div className="space-y-3">
            <div className="glass h-11 animate-pulse" />
            <div className="glass h-40 animate-pulse" />
            <div className="glass h-32 animate-pulse" />
          </div>
        ) : viewError || !view ? (
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {viewError ?? t("providerViewLoadError")}
            <button
              type="button"
              onClick={() => void refetchView()}
              className="ml-3 text-xs font-medium text-(--elizon-primary) underline-offset-2 hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <ProviderView
            view={view}
            serviceId={id}
            resourceName={server?.name}
            access={access}
            widgetContext={{
              server,
              network,
              onRefresh: () => void refresh(true),
              onOpenConsole: () => navigate({ name: "console", id }),
            }}
            onActionCompleted={handleActionCompleted}
            onOpenBilling={() => navigate({ name: "billing" })}
            onRefresh={() => void refresh(true)}
            onNavigateToInvoices={() => navigate({ name: "invoices" })}
            onNavigateToInvoiceDetail={(invoiceId) => navigate({ name: "invoice-detail", id: invoiceId })}
            onNavigateToInvoicePay={(invoiceId) => navigate({ name: "invoice-pay", id: invoiceId })}
          />
        )}
      </main>
    </div>
  );
}

function IdentityCard({
  server,
  identity,
}: {
  server: DashboardServer | null;
  identity: ProviderViewIdentity | null;
}) {
  const { t } = useI18n();

  const statusLabel: Record<ServerStatus, string> = {
    online: t("serverOnline"),
    offline: t("serverOffline"),
    starting: t("serverStarting"),
    stopping: t("serverStopping"),
  };

  const status = server?.status;
  const ip = identity?.primaryIpv4 || server?.ip || null;
  const region = identity?.region || server?.location || null;
  const product = identity?.productName || null;

  if (!server && !identity) {
    return <div className="glass h-28 animate-pulse" />;
  }

  return (
    <section className="glass p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", status ? dotClass[status] : "bg-(--text-muted)")} aria-hidden />
            <span className="truncate text-base font-semibold text-(--text-primary)">
              {identity?.displayName || identity?.name || server?.name}
            </span>
          </div>
          {product ? <p className="mt-1 text-xs text-(--text-muted)">{product}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {server?.isShared ? <Badge variant="outline">{t("serverShared")}</Badge> : null}
            {server?.terminationPending ? <Badge variant="warning">{t("serviceDeleting")}</Badge> : null}
            {server?.reinstallPending ? <Badge variant="warning">{t("serverReinstallPending")}</Badge> : null}
            {server?.suspendedAt ? <Badge variant="danger">{t("serverSuspended")}</Badge> : null}
          </div>
        </div>
        {status ? (
          <Badge variant={status === "online" ? "success" : status === "offline" ? "muted" : "warning"}>
            {statusLabel[status]}
          </Badge>
        ) : null}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-y-2 border-t border-(--border) pt-3 text-xs">
        {region ? <IdentityField label={t("serverLocation")} icon={MapPin} value={region} /> : null}
        {ip ? <IdentityField label={t("serverIp")} icon={Globe2} value={ip} /> : null}
        {identity?.node ? <IdentityField label={t("serverNode")} icon={ServerIcon} value={identity.node} /> : null}
      </dl>
    </section>
  );
}

function IdentityField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof MapPin;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-(--text-muted)">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium text-(--text-primary)">{value}</dd>
    </div>
  );
}

type PendingInvoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  claimHandedToCollection?: boolean;
};

function PaymentOverdueBanner({
  serviceId,
  onPayInvoice,
  onViewInvoice,
}: {
  serviceId: string;
  onPayInvoice: (invoiceId: string) => void;
  onViewInvoice: (invoiceId: string) => void;
}) {
  const { t, lang } = useI18n();
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, overdueRes] = await Promise.all([
        api.billing.invoices({ status: "PENDING", serviceId, limit: 10 }),
        api.billing.invoices({ status: "OVERDUE", serviceId, limit: 10 }),
      ]);
      const rows: PendingInvoice[] = [];
      for (const res of [pendingRes, overdueRes]) {
        if (res.success && Array.isArray(res.invoices)) {
          for (const inv of res.invoices as Array<Record<string, unknown>>) {
            rows.push({
              id: String(inv.id ?? ""),
              invoiceNumber: String(inv.invoiceNumber ?? inv.number ?? inv.id ?? ""),
              total: Number(inv.total ?? inv.amount ?? 0),
              claimHandedToCollection: Boolean(inv.claimHandedToCollection),
            });
          }
        }
      }
      const byId = new Map<string, PendingInvoice>();
      for (const inv of rows) byId.set(inv.id, inv);
      setInvoices([...byId.values()]);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="glass space-y-3 border border-(--warning)/30 bg-(--warning)/5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--warning)/15 text-(--warning)">
          <TriangleAlert className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-(--warning)">{t("serverSuspended")}</h3>
          <p className="text-xs text-(--text-secondary)">{t("serviceSuspendedDesc")}</p>
          <p className="text-xs text-(--text-muted)">
            {t("serviceSuspendedReason").replace("{reason}", t("suspendReasonPaymentOverdue"))}
          </p>
          <p className="text-xs font-medium text-(--text-primary)">{t("servicePayOpenInvoice")}</p>
          {loading ? (
            <p className="text-xs text-(--text-muted)">{t("loading")}</p>
          ) : invoices.length > 0 ? (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-(--surface-soft) px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xs text-(--text-secondary)">
                    {inv.invoiceNumber} · {formatMoney(inv.total, lang)}
                    {inv.claimHandedToCollection ? (
                      <span className="mt-0.5 block text-(--error)">{t("billingClaimHandedToCollection")}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      inv.claimHandedToCollection ? onViewInvoice(inv.id) : onPayInvoice(inv.id)
                    }
                    className="btn-primary rounded-xl px-3 py-1.5 text-xs font-medium"
                  >
                    {inv.claimHandedToCollection ? t("billingViewInvoice") : t("servicePayOpenInvoiceCta")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
