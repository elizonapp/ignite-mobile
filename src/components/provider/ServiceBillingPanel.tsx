import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, CreditCard, Loader2, RefreshCw, RotateCcw } from "lucide-react";

import type { ServiceSubscriptionSummary, SubscriptionBillingPreview } from "../../api/services";
import { resolveApiError } from "../../api/resolve-error";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { CancelFlowModal } from "../../features/billing/components/CancelFlowModal";
import { RenewServiceModal } from "../../features/billing/components/RenewServiceModal";
import {
  formatDate,
  formatMoney,
  getInvoiceStatusLabel,
  invoiceStatusTone,
  looseTranslate,
  openExternalUrl,
  resolveApiUrl,
  toneClasses,
} from "../../features/billing/lib";
import type { InvoiceListItem } from "../../features/billing/types";
import type { ServiceContractDocuments } from "../../api/services";
import { useToast } from "../Toast";
import { useAuth } from "../AuthProvider";
import { useI18n } from "../../i18n";
import { api } from "../../lib/api";
import { computePeriodPrice } from "../../lib/billing";
import { cn } from "../../lib/utils";
import { useProviderT } from "./use-provider-t";

const ALLOWED_CYCLES = [7, 14, 30, 60, 90, 120, 365] as const;

type ServiceBilling = {
  monthlyPrice?: number;
  periodPrice?: number;
  billingCycleDays?: number;
};

type ServiceProductMeta = {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName?: string;
};

type Props = {
  serviceId: string;
  serviceName: string;
  onRefresh?: () => void;
  onNavigateToInvoices?: () => void;
  onNavigateToInvoiceDetail?: (invoiceId: string) => void;
  onNavigateToInvoicePay?: (invoiceId: string) => void;
};

export function ServiceBillingPanel({
  serviceId,
  serviceName,
  onRefresh,
  onNavigateToInvoices,
  onNavigateToInvoiceDetail,
  onNavigateToInvoicePay,
}: Props) {
  const t = useProviderT();
  const { lang } = useI18n();
  const { user } = useAuth();
  const { show } = useToast();
  const translate = looseTranslate(t);

  const [subscription, setSubscription] = useState<ServiceSubscriptionSummary | null>(null);
  const [serviceProduct, setServiceProduct] = useState<ServiceProductMeta | null>(null);
  const [billing, setBilling] = useState<ServiceBilling | null>(null);
  const [contractDocs, setContractDocs] = useState<ServiceContractDocuments | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [allowedCycles, setAllowedCycles] = useState<number[]>([30]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingContractDocs, setLoadingContractDocs] = useState(true);
  const [intervalValue, setIntervalValue] = useState(30);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const [autopayLoading, setAutopayLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [bonusRenewLoading, setBonusRenewLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [businessBillingActive, setBusinessBillingActive] = useState(false);
  const [autoBillingEnabled, setAutoBillingEnabled] = useState(false);
  const [useNetPointsFirst, setUseNetPointsFirst] = useState(false);

  const isBusiness = ["business", "BUSINESS"].includes(user?.accountType ?? "");

  const loadSubscription = useCallback(async () => {
    setLoadingSub(true);
    try {
      const [subRes, svcRes, cyclesRes] = await Promise.all([
        api.services.subscriptionGet(serviceId),
        api.services.find(serviceId).catch(() => null),
        api.services.billingCycles(serviceId).catch(() => null),
      ]);

      if (subRes.success && subRes.subscription) {
        setSubscription(subRes.subscription);
        setIntervalValue(subRes.subscription.nextBillingCycleDays ?? subRes.subscription.billingCycleDays);
        setAutoBillingEnabled(subRes.subscription.options?.autoBillingEnabled ?? false);
        setUseNetPointsFirst(subRes.subscription.options?.useNetPointsFirst ?? false);
      } else {
        setSubscription(null);
      }

      const svc = svcRes?.server as Record<string, unknown> | undefined;
      const svcBilling = svc?.billing as ServiceBilling | undefined;
      if (svcBilling) setBilling(svcBilling);

      const product = svc?.product as Record<string, unknown> | undefined;
      const category = product?.productCategory as Record<string, unknown> | undefined;
      if (product?.id && product?.categoryId) {
        setServiceProduct({
          productId: String(product.id),
          productName: String(product.name ?? serviceName),
          categoryId: String(product.categoryId),
          categoryName: category?.name ? String(category.name) : undefined,
        });
      } else {
        setServiceProduct(null);
      }

      if (cyclesRes?.success && Array.isArray(cyclesRes.allowedBillingCycles)) {
        const cycles = cyclesRes.allowedBillingCycles
          .filter((d) => ALLOWED_CYCLES.includes(d as (typeof ALLOWED_CYCLES)[number]))
          .sort((a, b) => a - b);
        setAllowedCycles(cycles.length > 0 ? cycles : [30]);
      }
    } catch {
      setSubscription(null);
    } finally {
      setLoadingSub(false);
    }
  }, [serviceId, serviceName]);

  useEffect(() => {
    if (!isBusiness) {
      setBusinessBillingActive(false);
      return;
    }
    void api.business
      .billing()
      .then((data) => {
        if (data?.success && data.config) {
          const invoiceEnabled = data.config.invoiceEnabled === true || data.config.invoiceEnabled === 1;
          const hasActiveFund = data.config.hasActiveFund === true || data.config.hasActiveFund === 1;
          setBusinessBillingActive(invoiceEnabled || hasActiveFund);
        } else {
          setBusinessBillingActive(false);
        }
      })
      .catch(() => setBusinessBillingActive(false));
  }, [isBusiness]);

  const loadContractDocs = useCallback(async () => {
    setLoadingContractDocs(true);
    try {
      const res = await api.services.contractDocuments(serviceId);
      if (res.success && res.billingMode) {
        setContractDocs(res as ServiceContractDocuments);
      } else {
        setContractDocs(null);
      }
    } catch {
      setContractDocs(null);
    } finally {
      setLoadingContractDocs(false);
    }
  }, [serviceId]);

  const loadInvoices = useCallback(async () => {
    setLoadingInv(true);
    try {
      const res = await api.billing.invoices({ serviceId, limit: 20 });
      if (res.success && Array.isArray(res.invoices)) {
        setInvoices(res.invoices as InvoiceListItem[]);
      } else {
        setInvoices([]);
      }
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInv(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void loadSubscription();
    void loadInvoices();
    void loadContractDocs();
  }, [loadSubscription, loadInvoices, loadContractDocs]);

  const currentIntervalDays = subscription
    ? (subscription.nextBillingCycleDays ?? subscription.billingCycleDays)
    : 30;

  const periodPrice = useMemo(() => {
    if (billing?.periodPrice != null) return billing.periodPrice;
    if (subscription?.billingPreview?.nextRenewalGross != null) {
      return subscription.billingPreview.nextRenewalGross;
    }
    const monthly = billing?.monthlyPrice ?? 0;
    if (monthly > 0) return computePeriodPrice(monthly, currentIntervalDays);
    return 0;
  }, [billing, subscription, currentIntervalDays]);

  const billingDays = billing?.billingCycleDays ?? subscription?.billingCycleDays ?? 30;

  const billingPreview: SubscriptionBillingPreview | null = subscription?.billingPreview ?? null;
  const showRenewalDiscount =
    billingPreview != null && billingPreview.regularRenewalGross > billingPreview.nextRenewalGross + 0.005;
  const hasOrderCouponHint =
    Boolean(billingPreview?.orderCouponCodeSnapshot) ||
    ((billingPreview?.orderCouponDiscountAmount ?? 0) > 0.005);
  const hasScheduledRenewalDiscount = billingPreview?.adminScheduledAppliesToNextRenewal === true;
  const showDiscountOverview =
    !businessBillingActive &&
    billingPreview != null &&
    (Boolean(billingPreview.couponCode) ||
      hasOrderCouponHint ||
      billingPreview.couponKind !== "none" ||
      showRenewalDiscount ||
      hasScheduledRenewalDiscount);
  const showCouponRenewalStatus = Boolean(billingPreview?.couponCode);
  const showAfterExpiryNote =
    billingPreview != null &&
    billingPreview.couponKind === "finite" &&
    !billingPreview.couponAppliesToNextRenewal &&
    !hasScheduledRenewalDiscount;
  const showNextChargeRenewalFootnote =
    !businessBillingActive &&
    billingPreview != null &&
    (showRenewalDiscount || billingPreview.couponKind !== "none" || hasOrderCouponHint);
  const remainingCouponMonths =
    billingPreview != null &&
    billingPreview.couponKind === "finite" &&
    billingPreview.couponRecurringMonths != null &&
    billingPreview.couponRecurringMonths > 0
      ? Math.max(
          0,
          billingPreview.couponRecurringMonths -
            Math.ceil(billingPreview.effectiveMonthsElapsedAtNextRenewal),
        )
      : 0;

  const handleRefreshAfterBillingAction = async () => {
    await loadSubscription();
    await loadInvoices();
    onRefresh?.();
  };

  const handleSaveAutopay = async () => {
    setAutopayLoading(true);
    try {
      const res = await api.services.subscriptionAutopay(serviceId, {
        autoBillingEnabled,
        useNetPointsFirst,
      });
      if (res.success) {
        show(t("billingAutopaySaved"), "success");
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setAutopayLoading(false);
    }
  };

  const handleIntervalChange = async () => {
    if (!subscription || intervalLoading || intervalValue === currentIntervalDays) return;
    setIntervalLoading(true);
    try {
      const res = await api.services.subscriptionInterval(serviceId, intervalValue);
      if (res.success) {
        show(t("billingIntervalScheduled"), "success");
        await loadSubscription();
        onRefresh?.();
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setIntervalLoading(false);
    }
  };

  const handleReactivate = async () => {
    setReactivateLoading(true);
    try {
      const res = await api.services.subscriptionReactivate(serviceId);
      if (res.success) {
        show(t("serviceReactivateSuccess"), "success");
        await loadSubscription();
        onRefresh?.();
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleBonusRenew = async () => {
    setBonusRenewLoading(true);
    try {
      const res = await api.services.subscriptionExtend(serviceId, {
        withBonus: true,
        extensionDays: currentIntervalDays,
      });
      if (res.success && res.invoiceId) {
        show(t("serviceRenewInvoiceCreated"), "success");
        onNavigateToInvoicePay?.(res.invoiceId);
        await loadSubscription();
        await loadInvoices();
        onRefresh?.();
      } else if (res.success) {
        show(t("serviceReactivateSuccess"), "success");
        await loadSubscription();
        onRefresh?.();
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setBonusRenewLoading(false);
    }
  };

  const openDocument = (path: string | null | undefined, title: string) => {
    const url = resolveApiUrl(path);
    if (!url) return;
    openExternalUrl(url, { title });
  };

  if (loadingSub && !subscription) {
    return (
      <div className="space-y-3">
        <div className="glass h-28 animate-pulse" />
        <div className="glass h-24 animate-pulse" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <section className="glass p-4">
        <p className="text-sm text-(--text-muted)">{t("billingNoSubscription")}</p>
      </section>
    );
  }

  const isActive = subscription.status === "ACTIVE";
  const adminLockedCancel =
    subscription.cancelAtPeriodEnd &&
    subscription.cancellation?.source === "admin" &&
    subscription.cancellation.locked;
  const canCancel = isActive && !subscription.cancelAtPeriodEnd;
  const canReactivate = isActive && !!subscription.cancelAtPeriodEnd && !adminLockedCancel;

  const statusLabel = adminLockedCancel
    ? t("billingCanceledByAdminAtPeriodEnd").replace(
        "{date}",
        formatDate(subscription.currentPeriodEnd, lang),
      )
    : subscription.cancelAtPeriodEnd
      ? t("billingCancelingAtPeriodEnd")
      : subscription.status === "CANCELED"
        ? t("billingCanceled")
        : subscription.status === "ACTIVE"
          ? t("active")
          : subscription.status;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <section className="glass space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("billingSubscriptionSummary")}</h3>
          <p className="text-right text-sm font-bold tabular-nums text-(--text-primary)">
            {businessBillingActive ? (
              <>
                {formatMoney(periodPrice, lang)} / {billingDays} {t("days")}
              </>
            ) : showRenewalDiscount && billingPreview ? (
              <>
                <span className="mr-2 text-xs font-semibold text-(--text-muted) line-through">
                  {formatMoney(billingPreview.regularRenewalGross, lang)}
                </span>
                <span>
                  {formatMoney(billingPreview.nextRenewalGross, lang)} / {billingPreview.billedCycleDays} {t("days")}
                </span>
              </>
            ) : (
              <>
                {formatMoney(periodPrice, lang)} / {billingDays} {t("days")}
              </>
            )}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-(--text-muted)">{t("billingCurrentPeriod")}</dt>
            <dd className="mt-0.5 font-medium text-(--text-primary)">
              {formatDate(subscription.currentPeriodStart, lang)} – {formatDate(subscription.currentPeriodEnd, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-(--text-muted)">{t("billingInterval")}</dt>
            <dd className="mt-0.5 font-medium text-(--text-primary)">
              {subscription.billingCycleDays} {t("days")}
            </dd>
          </div>
          <div>
            <dt className="text-(--text-muted)">{t("billingNextCharge")}</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-(--text-primary)">
              {showRenewalDiscount && billingPreview ? (
                <>
                  <span className="mr-2 text-(--text-muted) line-through">
                    {formatMoney(billingPreview.regularRenewalGross, lang)}
                  </span>
                  <span>{formatMoney(billingPreview.nextRenewalGross, lang)}</span>
                </>
              ) : (
                formatMoney(periodPrice, lang)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-(--text-muted)">{t("billingStatus")}</dt>
            <dd className="mt-0.5 font-medium text-(--text-primary)">{statusLabel}</dd>
          </div>
        </dl>

        {subscription.nextBillingCycleDays != null && (
          <p className="text-xs text-(--elizon-primary)">
            {t("billingIntervalScheduledFromNext").replace("{days}", String(subscription.nextBillingCycleDays))}
          </p>
        )}
        {adminLockedCancel && subscription.cancellation?.reason ? (
          <p className="text-xs text-(--text-muted)">{subscription.cancellation.reason}</p>
        ) : null}
        {adminLockedCancel ? (
          <p className="text-xs text-(--text-secondary)">{t("billingAdminCancelNotRevocable")}</p>
        ) : null}
        {showNextChargeRenewalFootnote && billingPreview ? (
          <p className="text-[10px] text-(--text-muted)">
            {t("billingNextRenewalSummary")
              .replace("{date}", formatDate(subscription.currentPeriodEnd, lang))
              .replace("{amount}", formatMoney(billingPreview.nextRenewalGross, lang))}
          </p>
        ) : null}
      </section>

      {showDiscountOverview && billingPreview ? (
        <section className="glass space-y-3 border border-(--elizon-primary)/20 p-4">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("billingDiscountOverviewTitle")}</h3>
          {hasOrderCouponHint ? (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) p-3">
              <h4 className="text-xs font-semibold text-(--text-secondary)">{t("billingOrderCouponTitle")}</h4>
              {billingPreview.orderCouponCodeSnapshot ? (
                <div className="text-xs">
                  <span className="text-(--text-muted)">{t("billingOrderCouponCodeLabel")}</span>
                  <p className="mt-0.5 font-mono font-medium">{billingPreview.orderCouponCodeSnapshot}</p>
                </div>
              ) : null}
              {(billingPreview.orderCouponDiscountAmount ?? 0) > 0.005 ? (
                <p className="text-xs text-(--text-muted)">
                  {t("billingOrderCouponDiscountLabel")}:{" "}
                  <span className="font-medium tabular-nums text-(--text-primary)">
                    {formatMoney(billingPreview.orderCouponDiscountAmount ?? 0, lang)}
                  </span>
                </p>
              ) : null}
              <p className="text-[10px] text-(--text-muted)">{t("billingOrderCouponRenewalNote")}</p>
            </div>
          ) : null}
          {hasScheduledRenewalDiscount ? (
            <div className="space-y-1 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) p-3">
              <h4 className="text-xs font-semibold text-(--text-secondary)">
                {t("billingScheduledRenewalDiscountTitle")}
              </h4>
              <p className="text-xs text-(--text-secondary)">
                {t("billingScheduledRenewalDiscountApplies").replace(
                  "{percent}",
                  String(billingPreview.adminScheduledPercent ?? 0),
                )}
              </p>
              <p className="text-xs text-(--text-muted)">
                {t("billingScheduledRenewalDiscountAmount").replace(
                  "{amount}",
                  formatMoney(billingPreview.nextRenewalGross, lang),
                )}
              </p>
            </div>
          ) : null}
          {billingPreview.couponCode ? (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) p-3">
              <div className="text-xs">
                <span className="text-(--text-muted)">{t("billingDiscountCodeLabel")}</span>
                <p className="mt-0.5 font-mono font-medium">{billingPreview.couponCode}</p>
              </div>
              {billingPreview.couponKind === "finite" &&
              billingPreview.couponRecurringMonths != null &&
              billingPreview.couponRecurringMonths > 0 ? (
                <p className="text-xs font-medium text-(--text-primary)">
                  {t("billingRecurringTotalMonths").replace(
                    "{total}",
                    String(billingPreview.couponRecurringMonths),
                  )}
                </p>
              ) : null}
              {billingPreview.couponKind === "infinite" ? (
                <p className="text-xs text-(--text-secondary)">{t("billingDiscountInfinite")}</p>
              ) : null}
              {billingPreview.couponKind === "firstInvoiceOnly" ? (
                <p className="text-xs text-(--text-muted)">{t("billingDiscountFirstInvoiceOnly")}</p>
              ) : null}
              {showCouponRenewalStatus ? (
                <p className="text-xs text-(--text-secondary)">
                  {billingPreview.couponAppliesToNextRenewal
                    ? t("billingDiscountAppliesNextRenewal")
                    : t("billingDiscountDoesNotApplyNext")}
                </p>
              ) : null}
              {billingPreview.couponKind === "finite" &&
              billingPreview.couponRecurringMonths != null &&
              billingPreview.couponRecurringMonths > 0 ? (
                <>
                  <p className="text-xs text-(--text-muted)">
                    {t("billingDiscountFiniteRemainingNote").replace("{months}", String(remainingCouponMonths))}
                  </p>
                  {billingPreview.approxLastDiscountedBoundary ? (
                    <>
                      <p className="text-xs text-(--text-secondary)">
                        {t("billingDiscountApproxBoundary").replace(
                          "{date}",
                          formatDate(billingPreview.approxLastDiscountedBoundary, lang),
                        )}
                      </p>
                      <p className="text-[10px] text-(--text-muted)">
                        {t("billingDiscountApproxBoundaryDisclaimer")}
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}
              {showAfterExpiryNote ? (
                <p className="text-xs text-(--text-muted)">
                  {t("billingDiscountAfterExpiry").replace(
                    "{amount}",
                    formatMoney(billingPreview.regularRenewalGross, lang),
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
          {showRenewalDiscount ? (
            <div className="rounded-[var(--radius-control)] border border-(--elizon-primary)/20 bg-(--elizon-primary)/5 p-3">
              <p className="text-xs text-(--text-secondary)">
                {t("billingNextRenewalSummary")
                  .replace("{date}", formatDate(subscription.currentPeriodEnd, lang))
                  .replace("{amount}", formatMoney(billingPreview.nextRenewalGross, lang))}
              </p>
              <p className="mt-1 text-[10px] text-(--text-muted)">{t("billingNextRenewalAutoRenewNote")}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Reactivate */}
      {canReactivate && (
        <section className="glass space-y-3 border border-(--elizon-primary)/30 bg-(--elizon-primary)/5 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-(--elizon-primary)/15 text-(--elizon-primary)">
              <RotateCcw className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-sm font-semibold text-(--text-primary)">{t("serviceReactivateTitle")}</h3>
              <p className="text-xs text-(--text-muted)">{t("serviceReactivateDesc")}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleReactivate()}
                  disabled={reactivateLoading}
                  className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium disabled:opacity-50"
                >
                  {reactivateLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {reactivateLoading ? t("loading") : t("serviceReactivateButton")}
                </button>
                {subscription.extendEligibility?.bonusAvailable ? (
                  <button
                    type="button"
                    onClick={() => void handleBonusRenew()}
                    disabled={bonusRenewLoading}
                    className="btn-secondary inline-flex items-center gap-1.5 rounded-xl border border-(--elizon-primary)/30 px-4 py-2 text-xs font-medium text-(--elizon-primary) disabled:opacity-50"
                  >
                    {bonusRenewLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    {bonusRenewLoading ? t("loading") : t("serviceReactivateRenewButton")}
                  </button>
                ) : null}
              </div>
              {subscription.extendEligibility?.bonusAvailable ? (
                <p className="text-[10px] text-(--elizon-primary)/80">{t("serviceReactivateRenewCta")}</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* Contract documents */}
      <section className="glass space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("billingContractDocumentsTitle")}</h3>
          <p className="mt-0.5 text-xs text-(--text-muted)">{t("billingContractDocumentsDesc")}</p>
        </div>
        {loadingContractDocs ? (
          <div className="h-20 animate-pulse rounded-[var(--radius-control)] bg-(--surface-soft)" />
        ) : contractDocs ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-(--text-muted)">{t("billingStatus")}</dt>
                <dd className="mt-0.5 font-medium text-(--text-primary)">
                  {(contractDocs.billingMode || "").toUpperCase() === "CONTRACT"
                    ? t("billingContractModeContract")
                    : t("billingContractModePrepaid")}
                </dd>
              </div>
              {(contractDocs.billingMode || "").toUpperCase() === "CONTRACT" && (
                <>
                  <div>
                    <dt className="text-(--text-muted)">{t("billingContractTermMonths")}</dt>
                    <dd className="mt-0.5 font-medium text-(--text-primary)">
                      {contractDocs.conditions.contractTermMonths != null
                        ? `${contractDocs.conditions.contractTermMonths} ${t("billingMonthsShort")}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--text-muted)">{t("billingContractDiscountPercent")}</dt>
                    <dd className="mt-0.5 font-medium text-(--text-primary)">
                      {contractDocs.conditions.contractDiscountPercent != null
                        ? `${contractDocs.conditions.contractDiscountPercent} %`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--text-muted)">{t("billingContractBindingEndsAt")}</dt>
                    <dd className="mt-0.5 font-medium text-(--text-primary)">
                      {contractDocs.conditions.bindingEndsAt
                        ? formatDate(contractDocs.conditions.bindingEndsAt, lang)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--text-muted)">{t("billingContractNoticeDays")}</dt>
                    <dd className="mt-0.5 font-medium text-(--text-primary)">
                      {contractDocs.conditions.contractNoticeDays != null
                        ? `${contractDocs.conditions.contractNoticeDays} ${t("billingDaysShort")}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--text-muted)">{t("billingContractEarlyTerminationFee")}</dt>
                    <dd className="mt-0.5 font-medium text-(--text-primary)">
                      {contractDocs.conditions.earlyTerminationFeePercent != null
                        ? `${contractDocs.conditions.earlyTerminationFeePercent} %`
                        : "—"}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            <div>
              <h4 className="text-xs font-semibold text-(--text-secondary)">{t("billingContractLegalDocs")}</h4>
              {contractDocs.legalDocuments.length === 0 ? (
                <p className="mt-1 text-xs text-(--text-muted)">{t("billingContractLegalDocsEmpty")}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {contractDocs.legalDocuments.map((doc) => (
                    <li
                      key={doc.filename}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) px-3 py-2"
                    >
                      <span className="truncate text-xs text-(--text-primary)">{doc.filename}</span>
                      <button
                        type="button"
                        onClick={() => openDocument(doc.downloadUrl, doc.filename)}
                        className="shrink-0 text-xs font-medium text-(--elizon-primary)"
                      >
                        {t("billingDownload")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {contractDocs.dpa ? (
              <div>
                <h4 className="text-xs font-semibold text-(--text-secondary)">{t("billingContractDpaDocs")}</h4>
                {contractDocs.dpa.documents.length === 0 ? (
                  <p className="mt-1 text-xs text-(--text-muted)">{t("billingContractDpaEmpty")}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {contractDocs.dpa.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) px-3 py-2"
                      >
                        <span className="truncate text-xs text-(--text-primary)">{doc.fileName}</span>
                        <button
                          type="button"
                          onClick={() => openDocument(doc.downloadUrl, doc.fileName)}
                          className="shrink-0 text-xs font-medium text-(--elizon-primary)"
                        >
                          {t("billingDownload")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-(--text-muted)">{t("billingContractLegalDocsEmpty")}</p>
        )}
      </section>

      {/* Invoices */}
      <section className="glass space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("billingInvoicesForService")}</h3>
          {onNavigateToInvoices ? (
            <button
              type="button"
              onClick={onNavigateToInvoices}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-(--elizon-primary)"
            >
              {t("billingViewAllInvoices")}
              <ChevronRight className="size-3.5" />
            </button>
          ) : null}
        </div>

        {loadingInv ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[var(--radius-control)] bg-(--surface-soft)" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-xs text-(--text-muted)">{t("billingNoInvoices")}</p>
        ) : (
          <ul className="space-y-2">
            {invoices.slice(0, 5).map((inv) => {
              const tone = invoiceStatusTone(inv.claimHandedToCollection ? "OVERDUE" : inv.status);
              const label = getInvoiceStatusLabel(inv, translate);
              const unpaid = inv.status !== "PAID" && !inv.claimHandedToCollection;
              const dunningUrl = resolveApiUrl(
                inv.hasDunningDocument ? `/api/invoices/${inv.id}/dunning-document` : null,
              );
              return (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-(--surface-soft) px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-(--text-primary)">
                      {inv.invoiceNumber ?? inv.number ?? inv.id}
                    </p>
                    <p className="text-[10px] text-(--text-muted)">{formatDate(inv.dueDate ?? inv.issuedAt, lang)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium tabular-nums">{formatMoney(inv.amount ?? inv.total, lang)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", toneClasses(tone))}>
                      {label}
                    </span>
                    {onNavigateToInvoiceDetail ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToInvoiceDetail(inv.id)}
                        className="text-[10px] font-medium text-(--elizon-primary)"
                      >
                        {t("billingViewInvoice")}
                      </button>
                    ) : null}
                    {dunningUrl ? (
                      <button
                        type="button"
                        onClick={() => openDocument(dunningUrl, t("billingDunning"))}
                        className="text-[10px] font-medium text-(--elizon-primary)"
                      >
                        {t("billingDunningView")}
                      </button>
                    ) : null}
                    {unpaid && onNavigateToInvoicePay ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToInvoicePay(inv.id)}
                        className="text-[10px] font-medium text-(--elizon-primary)"
                      >
                        {t("billingPayInvoice")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Renew */}
      {isActive && !subscription.cancelAtPeriodEnd && !businessBillingActive && (
        <section className="glass space-y-3 border border-(--elizon-primary)/20 p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-(--elizon-primary)" />
            <h3 className="text-sm font-semibold text-(--text-primary)">{t("serviceRenewTitle")}</h3>
          </div>
          <p className="text-xs text-(--text-muted)">{t("serviceRenewDesc")}</p>
          <p className="text-[10px] text-(--text-muted)">{t("billingManualRenewalHint")}</p>
          <button
            type="button"
            onClick={() => setShowRenewModal(true)}
            disabled={!serviceProduct}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {t("serviceRenew")}
          </button>
        </section>
      )}

      {/* Interval change */}
      {isActive && !subscription.cancelAtPeriodEnd && !businessBillingActive && (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("billingChangeInterval")}</h3>
          <p className="text-xs text-(--text-muted)">{t("billingChangeIntervalDesc")}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1">
              <span className="text-xs text-(--text-muted)">{t("billingInterval")}</span>
              <select
                value={intervalValue}
                onChange={(e) => setIntervalValue(Number(e.target.value))}
                className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--elizon-primary) focus:outline-none"
              >
                {allowedCycles.map((d) => (
                  <option key={d} value={d}>
                    {d} {t("days")}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleIntervalChange()}
              disabled={intervalLoading || intervalValue === currentIntervalDays}
              className="btn-primary rounded-xl px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {intervalLoading ? t("loading") : t("billingScheduleIntervalChange")}
            </button>
          </div>
          {billingPreview &&
            (billingPreview.couponKind === "finite" ||
              billingPreview.couponAppliesToNextRenewal ||
              billingPreview.couponKind === "infinite") && (
              <p className="text-[10px] text-(--text-muted)">{t("billingIntervalChargeOnCouponNote")}</p>
            )}
        </section>
      )}

      {/* Autopay */}
      {isActive && !subscription.cancelAtPeriodEnd && !businessBillingActive && (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("serviceBillingAutopay")}</h3>
          <p className="text-xs text-(--text-muted)">{t("serviceBillingAutopayDesc")}</p>

          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-(--border) p-3">
            <input
              type="checkbox"
              checked={autoBillingEnabled}
              onChange={(e) => setAutoBillingEnabled(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--elizon-primary)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-(--text-primary)">{t("autopayFromBalance")}</span>
              <span className="mt-0.5 block text-xs text-(--text-muted)">{t("autopayFromBalanceDesc")}</span>
            </span>
          </label>

          {autoBillingEnabled && (
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-(--border) p-3">
              <input
                type="checkbox"
                checked={useNetPointsFirst}
                onChange={(e) => setUseNetPointsFirst(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--elizon-primary)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-(--text-primary)">{t("useNetPointsFirstOption")}</span>
                <span className="mt-0.5 block text-xs text-(--text-muted)">{t("useNetPointsFirstDesc")}</span>
              </span>
            </label>
          )}

          <button
            type="button"
            onClick={() => void handleSaveAutopay()}
            disabled={autopayLoading}
            className="btn-primary rounded-xl px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {autopayLoading ? t("loading") : t("save")}
          </button>
        </section>
      )}

      {/* Cancel */}
      {canCancel && (
        <section className="glass space-y-3 p-4">
          <h3 className="text-sm font-semibold text-(--text-primary)">{t("billingCancellation")}</h3>
          <p className="text-xs text-(--text-muted)">{t("billingCancellationDesc")}</p>
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="rounded-xl border border-(--error)/40 px-4 py-2 text-xs font-medium text-(--error) transition-colors hover:bg-(--error)/10"
          >
            {t("billingCancellation")}
          </button>
        </section>
      )}

      <CancelFlowModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        serviceName={serviceName}
        serviceId={serviceId}
        subscription={subscription}
        onCanceled={() => void handleRefreshAfterBillingAction()}
        onExtendRedirect={onNavigateToInvoicePay}
        t={translate}
        formatDate={(date) => formatDate(date, lang)}
      />

      {serviceProduct ? (
        <RenewServiceModal
          open={showRenewModal}
          onClose={() => setShowRenewModal(false)}
          serviceId={serviceId}
          serviceName={serviceName}
          productId={serviceProduct.productId}
          productName={serviceProduct.productName}
          categoryId={serviceProduct.categoryId}
          categoryName={serviceProduct.categoryName}
          allowedBillingCycles={allowedCycles}
          t={translate}
          lang={lang}
        />
      ) : null}
    </div>
  );
}

/** Banner for deferred provider actions (deletion / reinstall pending). */
export function ServicePendingActionBanner({
  terminationPending,
  reinstallPending,
}: {
  terminationPending?: boolean;
  reinstallPending?: boolean;
}) {
  const t = useProviderT();
  if (!terminationPending && !reinstallPending) return null;

  const title = terminationPending ? t("serviceDeletingBannerTitle") : t("serviceReinstallPendingTitle");
  const body = terminationPending ? t("serviceDeletingBannerBody") : t("serviceReinstallPendingBody");
  const Icon = terminationPending ? AlertTriangle : RefreshCw;

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass flex items-start gap-3 border border-(--warning)/30 bg-(--warning)/5 p-4"
    >
      <Icon className="size-5 shrink-0 text-(--warning)" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-(--text-primary)">{title}</p>
        <p className="text-xs text-(--text-muted)">{body}</p>
      </div>
    </div>
  );
}
