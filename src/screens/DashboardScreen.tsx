import { useEffect, useMemo, useState } from "react";

import { useAuth } from '../components/AuthProvider';
import { ContractOverduePaymentBanner } from '../components/dashboard/ContractOverduePaymentBanner';
import { MaintenanceBanner } from '../components/dashboard/MaintenanceBanner';
import { QuickActions } from '../components/dashboard/QuickActions';
import { ResourceUsage } from '../components/dashboard/ResourceUsage';
import { ServerCard } from '../components/dashboard/ServerCard';
import { StatGrid } from '../components/dashboard/StatGrid';
import {
  DashboardIconBadge,
  IconAffiliate,
  IconBusiness,
  IconDomain,
  IconFeedback,
  IconFamily,
  IconIpManager,
  IconKey,
  IconStorage,
  IconSupport,
  IconTag,
  IconVroute,
} from '../components/dashboard/dashboard-icons';
import { SkeletonList } from '../components/ui/SkeletonBlock';
import { useRouter } from '../components/Router';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBatchedServiceStatus } from '../hooks/useBatchedServiceStatus';
import { useI18n } from '../i18n';
import { isMobileNative } from '../lib/platform';
import { showElizonPlusFeatures, shouldShowTrafficPoolingUi } from '../lib/elizon-plus';
import { mergeLiveStatus } from '../lib/normalize';
import { api } from '../lib/api';

const PREVIEW_LIMIT = 4;

export function DashboardScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const {
    isLoading,
    error,
    servers,
    stats,
    maintenance,
    trafficSourceSummary,
    monthlyOffers,
    reload,
  } = useDashboardData();
  const [isAffiliate, setIsAffiliate] = useState(false);

  const showFamilyAdoptionBanner = useMemo(() => {
    if (!user?.dateOfBirth || user.familyGroupId) return false;
    const dob = new Date(user.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return false;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const md = now.getMonth() - dob.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < dob.getDate())) age -= 1;
    return age < 16;
  }, [user?.dateOfBirth, user?.familyGroupId]);

  useEffect(() => {
    api.affiliates
      .me()
      .then((d) => setIsAffiliate(d.success))
      .catch(() => setIsAffiliate(false));
  }, []);

  const previewServers = useMemo(() => servers.slice(0, PREVIEW_LIMIT), [servers]);
  const ids = useMemo(() => previewServers.map((s) => s.id), [previewServers]);
  const live = useBatchedServiceStatus(ids);
  const displayed = useMemo(
    () => previewServers.map((s) => (live[s.id] ? mergeLiveStatus(s, live[s.id]?.status ?? null) : s)),
    [previewServers, live],
  );

  const maintenanceById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const n of maintenance) map.set(n.serviceId, true);
    return map;
  }, [maintenance]);

  const maxOfferDiscount = monthlyOffers.length
    ? Math.max(...monthlyOffers.map((o) => o.discountPercent), 0)
    : 0;

  const showPlusFeatures = showElizonPlusFeatures(user);
  const showTrafficUi = shouldShowTrafficPoolingUi(user);

  const managementItems = ([
    showPlusFeatures ? { name: "storage" as const, icon: <IconStorage className="h-4 w-4" />, label: t("storageTitle") } : null,
    { name: "subdomains" as const, icon: <IconDomain className="h-4 w-4" />, label: t("subdomainTitle") },
    { name: "domains" as const, icon: <IconDomain className="h-4 w-4" />, label: t("domainsTitle") },
    { name: "ip-manager" as const, icon: <IconIpManager className="h-4 w-4" />, label: t("ipManagerTitle") },
    { name: "ssh-keys" as const, icon: <IconKey className="h-4 w-4" />, label: t("sshKeys") },
    { name: "family" as const, icon: <IconFamily className="h-4 w-4" />, label: t("familyTitle") },
    showPlusFeatures ? { name: "vroute" as const, icon: <IconVroute className="h-4 w-4" />, label: t("vrouteTitle") } : null,
    isAffiliate ? { name: "affiliate" as const, icon: <IconAffiliate className="h-4 w-4" />, label: t("affiliateTitle") } : null,
    { name: "feedback" as const, icon: <IconFeedback className="h-4 w-4" />, label: t("feedbackTitle") },
    (['business', 'BUSINESS'].includes(user?.accountType ?? '') ? { name: "business" as const, icon: <IconBusiness className="h-4 w-4" />, label: t("businessTitle") } : null),
    { name: "support" as const, icon: <IconSupport className="h-4 w-4" />, label: t("tabSupport") },
  ].filter(Boolean)) as Array<{
    name: "storage" | "subdomains" | "domains" | "ip-manager" | "family" | "vroute" | "affiliate" | "feedback" | "business" | "support" | "ssh-keys";
    icon: React.ReactNode;
    label: string;
  }>;

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-5 pb-24 pt-2">
        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">
            {error}
            <button
              type="button"
              onClick={() => reload()}
              className="ml-3 text-xs font-medium text-(--elizon-primary) underline-offset-2 hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        )}

        <ContractOverduePaymentBanner />

        {showFamilyAdoptionBanner ? (
          <section className="glass border border-(--warning)/40 p-4">
            <p className="text-sm text-(--text-primary)">{t("familyAdoptionDeadlineBanner")}</p>
            <button
              type="button"
              onClick={() => navigate({ name: "family" })}
              className="btn-secondary mt-3 px-3 py-2 text-xs font-medium"
            >
              {t("familyTitle")}
            </button>
          </section>
        ) : null}

        <StatGrid stats={stats} isLoading={isLoading} />

        {maintenance.length > 0 && (
          <MaintenanceBanner notes={maintenance} onSelect={(id) => navigate({ name: "server", id })} />
        )}

        {servers.length === 0 && monthlyOffers.length > 0 && (
          <section className="glass border border-(--elizon-primary)/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <DashboardIconBadge>
                  <IconTag className="h-4 w-4" />
                </DashboardIconBadge>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-(--text-primary)">{t("monthlyOffersDashboardBannerTitle")}</p>
                  <p className="text-xs text-(--text-muted)">
                    {t("monthlyOffersDashboardBannerSubtitle").replace("{discount}", String(maxOfferDiscount))}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate({ name: "monthly-offers" })}
                className="btn-primary shrink-0 px-3 py-2 text-xs font-medium"
              >
                {t("monthlyOffersDashboardBannerCta")}
              </button>
            </div>
          </section>
        )}

        {showTrafficUi && trafficSourceSummary && (
          <section className="glass p-4 space-y-2">
            <h2 className="text-sm font-semibold text-(--text-primary)">{t("trafficSourceSummaryTitle")}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-(--text-muted) sm:grid-cols-3">
              <p>{t("trafficSourceServiceLabel")}: {trafficSourceSummary.serviceSourceCounts.SERVICE}</p>
              <p>{t("trafficSourcePoolLabel")}: {trafficSourceSummary.serviceSourceCounts.POOL}</p>
              <p>{t("trafficSourceWalletLabel")}: {trafficSourceSummary.serviceSourceCounts.WALLET}</p>
              <p>{t("trafficSourceWalletBalance")}: {trafficSourceSummary.walletBalanceTb.toFixed(2)} TB</p>
              <p>{t("trafficSourceWalletUsed")}: {trafficSourceSummary.walletUsedTb.toFixed(2)} TB</p>
            </div>
          </section>
        )}

        {isMobileNative() && (
          <section className="space-y-2">
            <SectionTitle title={t("quickActions")} />
            <QuickActions />
          </section>
        )}

        {isMobileNative() && managementItems.length > 0 && (
          <section className="space-y-2">
            <SectionTitle title={t("management")} />
            <div className="grid grid-cols-2 gap-2">
              {managementItems.map(({ name, icon, label }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => navigate({ name })}
                  className="glass glass-hover flex items-center gap-2.5 rounded-xl p-3 text-left"
                >
                  <DashboardIconBadge className="size-8">{icon}</DashboardIconBadge>
                  <span className="text-xs font-medium text-(--text-primary) leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionTitle title={t("yourServers")} />
            <button
              type="button"
              onClick={() => navigate({ name: "servers" })}
              className="text-[11px] font-medium text-(--elizon-primary)"
            >
              {t("viewAll")}
            </button>
          </div>

          {isLoading ? (
            <SkeletonList count={3} />
          ) : displayed.length === 0 ? (
            <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("noServers")}</div>
          ) : (
            <div className="space-y-3">
              {displayed.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onOpen={(id) => navigate({ name: "server", id })}
                  maintenance={maintenanceById.get(server.id)}
                />
              ))}
            </div>
          )}
        </section>

        <ResourceUsage servers={displayed} />
      </main>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-(--text-primary)">{title}</h2>;
}

