import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Globe, Loader2, Server, Trash2 } from "lucide-react";

import { useAuth } from "../components/AuthProvider";
import { DnsListToolbar } from "../components/dns/dns-list-toolbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import { formatResourceStatus } from "../i18n/format-status";
import type { ByoipDdosMarketing, ByoipNetwork } from "../api/byoip";
import { formatDate, formatMoney, openExternalUrl } from "../features/billing/lib";
import { api } from "../lib/api";
import { canPurchase, isDesktopClient } from "../lib/platform";
import { cn } from "../lib/utils";

const LEGACY_STANDARD_DDOS = ["PLETX", "STANDARD"];

function isStandardDdosProvider(providerKey: string | null | undefined): boolean {
  if (!providerKey) return true;
  return LEGACY_STANDARD_DDOS.includes(providerKey.toUpperCase());
}

function resolveDdosName(
  providerKey: string,
  marketing: ByoipDdosMarketing,
): string {
  if (isStandardDdosProvider(providerKey)) return marketing.standardProviderName;
  if (providerKey.toUpperCase() === marketing.premiumProviderKey.toUpperCase()) {
    return marketing.premiumDisplayName || marketing.premiumProviderKey;
  }
  return providerKey;
}

function tpl(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value),
    text,
  );
}

type ServiceOption = { id: string; name: string };

export function ByoipScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const desktop = isDesktopClient();

  const [networks, setNetworks] = useState<ByoipNetwork[]>([]);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[]>([]);
  const [walletPricePerTbGross, setWalletPricePerTbGross] = useState(5);
  const [ddosMarketing, setDdosMarketing] = useState<ByoipDdosMarketing>({
    standardProviderName: "voxility",
    premiumDisplayName: "",
    premiumProviderKey: "VOXILITY",
    premiumVisible: false,
  });
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showApply, setShowApply] = useState(false);
  const [applyPrefix, setApplyPrefix] = useState("");
  const [applyLocationId, setApplyLocationId] = useState("");
  const [applyOwnerType, setApplyOwnerType] = useState<"SELF" | "EXTERNAL">("SELF");
  const [applyExternalOwner, setApplyExternalOwner] = useState("");
  const [applyDesc, setApplyDesc] = useState("");
  const [applyDoc, setApplyDoc] = useState<File | null>(null);
  const [applying, setApplying] = useState(false);

  const [assignNetworkId, setAssignNetworkId] = useState<string | null>(null);
  const [assignServiceId, setAssignServiceId] = useState("");
  const [assignPrefix, setAssignPrefix] = useState("");
  const [assignIsPrimary, setAssignIsPrimary] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [busyNetworkId, setBusyNetworkId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [walletTopupTb, setWalletTopupTb] = useState("1");

  const isElizonPlus = user?.elizonPlusActive === true;
  const premiumName = ddosMarketing.premiumDisplayName || ddosMarketing.premiumProviderKey;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, svcRes] = await Promise.all([
        api.byoip.status(),
        api.services.list(100),
      ]);
      if (statusRes.success) {
        setNetworks(statusRes.networks ?? []);
        setAllowedLocationIds(statusRes.allowedLocationIds ?? []);
        setWalletPricePerTbGross(Number(statusRes.walletPricePerTbGross ?? 5));
        if (statusRes.ddosMarketing) setDdosMarketing(statusRes.ddosMarketing);
        setError(null);
      } else {
        setError(resolveApiError(statusRes, t, { fallbackKey: "byoipLoadError" }));
      }
      const svcList = svcRes.servers ?? svcRes.services;
      if (svcRes.success && Array.isArray(svcList)) {
        setServices(
          (svcList as Array<{ id: string; name: string; status?: string }>)
            .filter((s) => !s.status || s.status === "ACTIVE" || s.status === "RUNNING")
            .map((s) => ({ id: s.id, name: s.name })),
        );
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t, "byoipLoadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  useEffect(() => {
    if (showApply && !applyLocationId && allowedLocationIds[0]) {
      setApplyLocationId(allowedLocationIds[0]);
    }
  }, [showApply, applyLocationId, allowedLocationIds]);

  const walletTopupAmount = Number(walletTopupTb);
  const walletTopupCostGross =
    Number.isFinite(walletTopupAmount) && walletTopupAmount > 0
      ? walletTopupAmount * walletPricePerTbGross
      : 0;

  const canSubmitApply =
    !!applyPrefix.trim() &&
    !!applyLocationId &&
    !!applyDoc &&
    (applyOwnerType === "SELF" || !!applyExternalOwner.trim());

  const openApply = () => {
    setApplyPrefix("");
    setApplyLocationId(allowedLocationIds[0] ?? "");
    setApplyOwnerType("SELF");
    setApplyExternalOwner("");
    setApplyDesc("");
    setApplyDoc(null);
    setShowApply(true);
  };

  const handleApply = async () => {
    if (!canSubmitApply || !applyDoc) return;
    setApplying(true);
    try {
      const fd = new FormData();
      fd.append("prefix", applyPrefix.trim());
      fd.append("targetLocationId", applyLocationId);
      fd.append("ownerType", applyOwnerType);
      if (applyOwnerType === "EXTERNAL") {
        fd.append("externalOwnerName", applyExternalOwner.trim().slice(0, 200));
      }
      if (applyDesc.trim()) fd.append("description", applyDesc.trim());
      fd.append("document", applyDoc);
      const res = await api.byoip.apply(fd);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("byoipApplySuccess"), "success");
      setShowApply(false);
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setApplying(false);
    }
  };

  const openAssign = (networkId: string) => {
    setAssignNetworkId(networkId);
    setAssignServiceId(services[0]?.id ?? "");
    setAssignPrefix("");
    setAssignIsPrimary(false);
    if (!desktop) setExpandedId(networkId);
  };

  const handleAssign = async () => {
    if (!assignNetworkId || !assignPrefix.trim() || !assignServiceId) return;
    setAssigning(true);
    try {
      const res = await api.byoip.assign({
        networkId: assignNetworkId,
        serviceId: assignServiceId,
        prefix: assignPrefix.trim(),
        isPrimary: assignIsPrimary,
      });
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("byoipAssignSuccess"), "success");
      setAssignNetworkId(null);
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    setRemovingId(assignmentId);
    try {
      const res = await api.byoip.unassign(assignmentId);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("byoipUnassignSuccess"), "success");
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setRemovingId(null);
    }
  };

  const handleSubscribe = async (networkId: string, paymentMethod: "guthaben" | "mollie") => {
    setBusyNetworkId(networkId);
    try {
      const res = await api.byoip.subscribe(networkId, paymentMethod);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      if (res.checkoutUrl) {
        openExternalUrl(res.checkoutUrl);
      } else {
        show(t("byoipSubscribeSuccess"), "success");
        await load();
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyNetworkId(null);
    }
  };

  const handleCancel = async (networkId: string) => {
    setBusyNetworkId(networkId);
    try {
      const res = await api.byoip.cancel(networkId);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("byoipCancelSuccess"), "success");
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyNetworkId(null);
    }
  };

  const handleWalletTopup = async (networkId: string) => {
    setBusyNetworkId(networkId);
    try {
      const res = await api.byoip.walletTopup(networkId, walletTopupAmount, "guthaben");
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("byoipWalletTopupSuccess"), "success");
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyNetworkId(null);
    }
  };

  const handlePremiumMigration = async (networkId: string) => {
    setBusyNetworkId(networkId);
    try {
      const res = await api.byoip.requestPremiumDdosMigration(networkId);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(tpl(t("byoipPremiumDdosMigrationSuccess"), { name: premiumName }), "success");
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyNetworkId(null);
    }
  };

  const handleDeannouncement = async (networkId: string) => {
    setBusyNetworkId(networkId);
    try {
      const res = await api.byoip.requestDeannouncement(networkId);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(
        res.alreadyRequested ? t("byoipDeannounceAlreadyRequested") : t("byoipDeannounceRequestedSuccess"),
        "success",
      );
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusyNetworkId(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-(--text-muted)" />
        </div>
      </div>
    );
  }

  if (!isElizonPlus) {
    return (
      <div className="mt-8 mx-auto w-full max-w-screen lg:max-w-6xl page-fullwidth">
        <div className="glass p-8 text-center">
          <h2 className="text-lg font-semibold text-(--text-primary)">{t("byoipElizonPlusRequired")}</h2>
          <p className="mt-2 text-sm text-(--text-muted)">{t("byoipElizonPlusRequiredDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-3 pb-24 pt-2">
        <div>
          <h1 className="text-base font-semibold text-(--text-primary)">{t("byoipTitle")}</h1>
          <p className="text-xs text-(--text-muted)">{t("byoipDescription")}</p>
        </div>

        {canPurchase() && (
          <DnsListToolbar
            addLabel={t("byoipApply")}
            onAdd={() => (showApply ? setShowApply(false) : openApply())}
            onRefresh={() => void load()}
            isRefreshing={isLoading}
          />
        )}

        {canPurchase() && showApply && (
          <ApplyFormPanel
            t={t}
            applyPrefix={applyPrefix}
            setApplyPrefix={setApplyPrefix}
            applyLocationId={applyLocationId}
            setApplyLocationId={setApplyLocationId}
            allowedLocationIds={allowedLocationIds}
            applyOwnerType={applyOwnerType}
            setApplyOwnerType={setApplyOwnerType}
            applyExternalOwner={applyExternalOwner}
            setApplyExternalOwner={setApplyExternalOwner}
            applyDesc={applyDesc}
            setApplyDesc={setApplyDesc}
            applyDoc={applyDoc}
            setApplyDoc={setApplyDoc}
            applying={applying}
            canSubmit={canSubmitApply}
            onCancel={() => setShowApply(false)}
            onSubmit={() => void handleApply()}
            desktop={desktop}
          />
        )}

        {canPurchase() && assignNetworkId && (
          <AssignFormPanel
            t={t}
            services={services}
            assignServiceId={assignServiceId}
            setAssignServiceId={setAssignServiceId}
            assignPrefix={assignPrefix}
            setAssignPrefix={setAssignPrefix}
            assignIsPrimary={assignIsPrimary}
            setAssignIsPrimary={setAssignIsPrimary}
            assigning={assigning}
            onCancel={() => setAssignNetworkId(null)}
            onSubmit={() => void handleAssign()}
          />
        )}

        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">{error}</div>
        )}

        {networks.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("byoipEmpty")}</div>
        ) : (
          networks.map((network) => {
            const expanded = expandedId === network.id;
            const busy = busyNetworkId === network.id;
            return (
              <section key={network.id} className="glass space-y-3 p-4">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : network.id)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--surface-soft) text-(--elizon-primary)">
                    <Globe className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-(--text-primary)">{network.prefix}</span>
                      <StatusBadge status={network.status} t={t} />
                      <span className="rounded-full bg-(--surface-soft) px-2 py-0.5 text-[10px] text-(--text-muted)">
                        {t("byoipDdosLabel")}: {resolveDdosName(network.ddosProtectionProvider, ddosMarketing)}
                      </span>
                      {network.isAdminGrant && (
                        <span className="rounded-full bg-(--surface-soft) px-2 py-0.5 text-[10px] text-(--elizon-primary)">
                          {t("byoipAdminGrant")}
                        </span>
                      )}
                      {network.cancelAtPeriodEnd && (
                        <span className="rounded-full bg-(--warning)/15 px-2 py-0.5 text-[10px] text-(--warning)">
                          {t("byoipCancelingAt")}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-(--text-muted)">
                      {[
                        network.asnNumber ? `ASN ${network.asnNumber}` : null,
                        network.locationId ? `${t("byoipLocation")}: ${network.locationId}` : null,
                        network.currentPeriodEnd
                          ? `${t("byoipRenewsAt")}: ${formatDate(network.currentPeriodEnd, lang)}`
                          : null,
                        `${t("byoipAssignments")}: ${network.assignments.length}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-(--text-muted) transition-transform", expanded && "rotate-180")}
                  />
                </button>

                {canPurchase() && (
                  <div className="flex flex-wrap gap-2">
                    {network.status === "APPROVED" && !network.isAdminGrant && (
                      <>
                        <ActionChip
                          label={busy ? t("byoipActivating") : t("byoipActivate")}
                          disabled={busy}
                          onClick={() => void handleSubscribe(network.id, "mollie")}
                        />
                        <ActionChip
                          label={busy ? t("byoipActivating") : t("byoipActivateWithBalance")}
                          disabled={busy}
                          onClick={() => void handleSubscribe(network.id, "guthaben")}
                        />
                      </>
                    )}
                    {network.status === "ACTIVE" && !network.cancelAtPeriodEnd && !network.isAdminGrant && (
                      <ActionChip
                        label={busy ? t("byoipCanceling") : t("byoipCancel")}
                        disabled={busy}
                        variant="danger"
                        onClick={() => void handleCancel(network.id)}
                      />
                    )}
                    {network.status === "ACTIVE" && (
                      <>
                        <ActionChip
                          label={busy ? t("byoipDeannounceRequesting") : t("byoipDeannounceRequest")}
                          disabled={busy}
                          onClick={() => void handleDeannouncement(network.id)}
                        />
                        <ActionChip
                          label={t("byoipAssign")}
                          onClick={() => openAssign(network.id)}
                        />
                      </>
                    )}
                  </div>
                )}

                {expanded && (
                  <div className="space-y-3 border-t border-(--border) pt-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <Row label={t("byoipMonthlyFee")} value={formatMoney(network.monthlyFeeGross, lang)} />
                      <Row
                        label={t("byoipTbWallet")}
                        value={t("byoipTbWalletValue")
                          .replace("{used}", network.tbWalletUsedTb.toFixed(2))
                          .replace("{total}", network.tbWalletBalanceTb.toFixed(2))}
                      />
                    </div>

                    {network.status === "ACTIVE" && canPurchase() && (
                      <div className="rounded-xl border border-(--border) bg-(--surface-soft)/50 p-3 space-y-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div className="space-y-1 text-xs text-(--text-muted)">
                            <p>
                              {t("byoipWalletUnitPrice")}:{" "}
                              <span className="font-semibold text-(--text-primary)">
                                {formatMoney(walletPricePerTbGross, lang)}/TB
                              </span>
                            </p>
                            <p>
                              {t("byoipWalletTopupCost")}:{" "}
                              <span className="font-semibold text-(--text-primary)">
                                {formatMoney(walletTopupCostGross, lang)}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={walletTopupTb}
                              onChange={(e) => setWalletTopupTb(e.target.value)}
                              className="h-9 w-24 rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={() => void handleWalletTopup(network.id)}
                              disabled={busy}
                              className="glass glass-hover rounded-xl px-3 py-2 text-xs font-medium text-(--text-secondary) disabled:opacity-50"
                            >
                              {t("byoipWalletTopupButton")}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-(--text-muted) space-y-0.5">
                          <p>{t("byoipWalletBillingTitle")}</p>
                          <p>{t("byoipWalletBillingLine1")}</p>
                          <p>{t("byoipWalletBillingLine2")}</p>
                        </div>
                        {ddosMarketing.premiumVisible &&
                          isStandardDdosProvider(network.ddosProtectionProvider) && (
                          <div className="border-t border-(--border) pt-3">
                            <p className="text-xs text-(--text-muted)">
                              {tpl(t("byoipWalletPremiumDdosHint"), { premiumDdosName: premiumName })}{" "}
                              {formatMoney(walletPricePerTbGross, lang)}/TB.
                            </p>
                            <button
                              type="button"
                              onClick={() => void handlePremiumMigration(network.id)}
                              disabled={
                                busy ||
                                network.ddosMigrationRequestedProvider?.toUpperCase() ===
                                  ddosMarketing.premiumProviderKey.toUpperCase()
                              }
                              className="mt-2 glass glass-hover rounded-xl px-3 py-2 text-xs font-medium text-(--text-secondary) disabled:opacity-50"
                            >
                              {network.ddosMigrationRequestedProvider?.toUpperCase() ===
                              ddosMarketing.premiumProviderKey.toUpperCase()
                                ? tpl(t("byoipPremiumDdosRequested"), { name: premiumName })
                                : tpl(t("byoipRequestPremiumDdos"), { name: premiumName })}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {network.assignments.length === 0 ? (
                      <p className="text-sm text-(--text-muted)">{t("byoipNoAssignments")}</p>
                    ) : (
                      <div className="space-y-2">
                        {network.assignments.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-(--border) px-3 py-2 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-(--text-primary)">{a.assignedPrefix}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-(--text-muted)">
                                <Server className="size-3.5" />
                                {a.service?.name ?? t("na")}
                                {a.isPrimary && (
                                  <span className="rounded-full bg-(--success)/15 px-1.5 py-0.5 text-[10px] text-(--success)">
                                    {t("byoipPrimary")}
                                  </span>
                                )}
                              </span>
                            </div>
                            {canPurchase() && network.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => void handleUnassign(a.id)}
                                disabled={removingId === a.id}
                                className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error) disabled:opacity-50"
                                aria-label={t("delete")}
                              >
                                {removingId === a.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-(--success)/15 text-(--success)"
      : status === "REJECTED" || status === "TERMINATED"
        ? "bg-(--error)/15 text-(--error)"
        : "bg-(--surface-soft) text-(--text-muted)";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone)}>
      {formatResourceStatus(status, t)}
    </span>
  );
}

function ActionChip({
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "glass glass-hover rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50",
        variant === "danger"
          ? "text-(--error) hover:bg-(--error)/10"
          : "text-(--text-secondary)",
      )}
    >
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="font-medium text-(--text-primary)">{value}</span>
    </div>
  );
}

type ApplyFormPanelProps = {
  t: (key: string) => string;
  applyPrefix: string;
  setApplyPrefix: (v: string) => void;
  applyLocationId: string;
  setApplyLocationId: (v: string) => void;
  allowedLocationIds: string[];
  applyOwnerType: "SELF" | "EXTERNAL";
  setApplyOwnerType: (v: "SELF" | "EXTERNAL") => void;
  applyExternalOwner: string;
  setApplyExternalOwner: (v: string) => void;
  applyDesc: string;
  setApplyDesc: (v: string) => void;
  applyDoc: File | null;
  setApplyDoc: (v: File | null) => void;
  applying: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  desktop: boolean;
};

function ApplyFormPanel(props: ApplyFormPanelProps) {
  const {
    t,
    applyPrefix,
    setApplyPrefix,
    applyLocationId,
    setApplyLocationId,
    allowedLocationIds,
    applyOwnerType,
    setApplyOwnerType,
    applyExternalOwner,
    setApplyExternalOwner,
    applyDesc,
    setApplyDesc,
    applyDoc,
    setApplyDoc,
    applying,
    canSubmit,
    onCancel,
    onSubmit,
  } = props;

  const content = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-(--text-primary)">{t("byoipApplyTitle")}</p>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("byoipApplyPrefix")} *</Label>
        <Input
          value={applyPrefix}
          onChange={(e) => setApplyPrefix(e.target.value)}
          placeholder="203.0.113.0/24"
          className="h-10 rounded-xl font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("byoipApplyLocation")} *</Label>
        <select
          value={applyLocationId}
          onChange={(e) => setApplyLocationId(e.target.value)}
          className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
        >
          <option value="">{t("byoipApplyLocationPlaceholder")}</option>
          {allowedLocationIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        {allowedLocationIds.length === 0 && (
          <p className="text-xs text-(--warning)">{t("byoipApplyNoLocations")}</p>
        )}
      </div>
      <p className="rounded-xl border border-(--border) bg-(--surface-soft)/50 px-3 py-2 text-xs text-(--text-muted)">
        {t("byoipApplyAsnFixedHint")}
      </p>
      <div className="space-y-2">
        <Label className="text-xs text-(--text-muted)">{t("byoipApplyOwnerType")} *</Label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={applyOwnerType === "SELF"}
              onChange={() => setApplyOwnerType("SELF")}
            />
            {t("byoipApplyOwnerSelf")}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={applyOwnerType === "EXTERNAL"}
              onChange={() => setApplyOwnerType("EXTERNAL")}
            />
            {t("byoipApplyOwnerExternal")}
          </label>
        </div>
        {applyOwnerType === "EXTERNAL" && (
          <Input
            value={applyExternalOwner}
            maxLength={200}
            onChange={(e) => setApplyExternalOwner(e.target.value)}
            placeholder={t("byoipApplyOwnerExternalPlaceholder")}
            className="h-10 rounded-xl"
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("byoipApplyDescription")}</Label>
        <textarea
          value={applyDesc}
          onChange={(e) => setApplyDesc(e.target.value)}
          rows={2}
          placeholder={t("byoipApplyDescriptionPlaceholder")}
          className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("byoipApplyDocument")} *</Label>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setApplyDoc(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-(--text-primary) file:mr-3 file:rounded-xl file:border file:border-(--border) file:bg-(--surface-soft) file:px-3 file:py-1.5 file:text-xs"
        />
        <p className="text-xs text-(--text-muted)">{t("byoipApplyDocumentHint")}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1 rounded-xl">{t("cancel")}</Button>
        <Button
          onClick={onSubmit}
          disabled={applying || !canSubmit}
          className="btn-primary flex-1 justify-center rounded-xl"
        >
          {applying ? t("byoipApplying") : t("byoipApplySubmit")}
        </Button>
      </div>
    </div>
  );

  if (props.desktop) {
    return <div className="glass p-4">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto p-4">{content}</div>
    </div>
  );
}

function AssignFormPanel({
  t,
  services,
  assignServiceId,
  setAssignServiceId,
  assignPrefix,
  setAssignPrefix,
  assignIsPrimary,
  setAssignIsPrimary,
  assigning,
  onCancel,
  onSubmit,
}: {
  t: (key: string) => string;
  services: ServiceOption[];
  assignServiceId: string;
  setAssignServiceId: (v: string) => void;
  assignPrefix: string;
  setAssignPrefix: (v: string) => void;
  assignIsPrimary: boolean;
  setAssignIsPrimary: (v: boolean) => void;
  assigning: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="glass space-y-3 p-4">
      <p className="text-sm font-medium text-(--text-primary)">{t("byoipAssignTitle")}</p>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("byoipAssignService")}</Label>
        <select
          value={assignServiceId}
          onChange={(e) => setAssignServiceId(e.target.value)}
          className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("byoipAssignPrefix")} *</Label>
        <Input
          value={assignPrefix}
          onChange={(e) => setAssignPrefix(e.target.value)}
          placeholder="203.0.113.5/32"
          className="h-10 rounded-xl font-mono"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-(--text-secondary)">
        <input
          type="checkbox"
          checked={assignIsPrimary}
          onChange={(e) => setAssignIsPrimary(e.target.checked)}
          className="size-4 rounded border-(--border)"
        />
        {t("byoipAssignIsPrimary")}
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1 rounded-xl">{t("cancel")}</Button>
        <Button
          onClick={onSubmit}
          disabled={assigning || !assignPrefix.trim() || !assignServiceId}
          className="btn-primary flex-1 justify-center rounded-xl"
        >
          {assigning ? t("byoipAssigning") : t("byoipAssignSubmit")}
        </Button>
      </div>
    </div>
  );
}
