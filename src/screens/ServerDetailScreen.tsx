import { ChevronLeft, Globe2, MapPin, RefreshCcw, Server as ServerIcon } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useRouter } from "../components/Router";
import { ProviderView } from "../components/provider";
import { useI18n } from "../i18n";
import { useServiceDetail } from "../hooks/useServiceDetail";
import { useProviderView } from "../hooks/useProviderView";
import { cn } from "../lib/utils";
import type { DashboardServer, ServerStatus } from "../lib/types";
import type { ProviderViewIdentity } from "../components/provider";

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
