import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { getApiErrorCode, resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { useToast } from "../../../components/Toast";
import { api } from "../../../lib/api";
import { cartService } from "../../../lib/cart-service";
import { formatDate, formatMoney } from "../lib";
import type { Lang } from "../../../i18n";

export type RenewServiceModalProps = {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
  productId: string;
  productName: string;
  categoryId: string;
  categoryName?: string;
  allowedBillingCycles: number[];
  t: (key: keyof import("../../../i18n/en").Dict) => string;
  lang: Lang;
};

type RenewPreview = {
  price: number;
  currentPeriodEnd: string;
  newPeriodEnd: string;
  subscriptionId: string;
  promotionSavingsMonthlyApprox?: number;
};

export function RenewServiceModal({
  open,
  onClose,
  serviceId,
  productId,
  productName,
  categoryId,
  categoryName,
  allowedBillingCycles,
  t,
  lang,
}: RenewServiceModalProps) {
  const { show } = useToast();
  const [selectedCycle, setSelectedCycle] = useState<number>(allowedBillingCycles[0] ?? 30);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<RenewPreview | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  const fetchPreview = useCallback(
    async (cycle: number) => {
      setPreviewLoading(true);
      try {
        const res = await api.services.renewPreview(serviceId, cycle);
        if (res.success && res.price != null && res.currentPeriodEnd && res.newPeriodEnd && res.subscriptionId) {
          setRenewalError(null);
          setPreview({
            price: res.price,
            currentPeriodEnd: res.currentPeriodEnd,
            newPeriodEnd: res.newPeriodEnd,
            subscriptionId: res.subscriptionId,
            promotionSavingsMonthlyApprox: res.promotionSavingsMonthlyApprox,
          });
        } else {
          setPreview(null);
          if (getApiErrorCode(res) === "theTotalRuntimeCannotExceed3YearsFromToday") {
            const msg = t("renewalExceedsMaxRuntime")
              .replace("{newEnd}", formatDate(res.newPeriodEnd, lang))
              .replace("{maxDate}", formatDate(res.maxDate, lang));
            setRenewalError(msg);
          } else {
            setRenewalError(null);
            show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
          }
        }
      } catch (err) {
        setPreview(null);
        show(resolveCaughtApiError(err, t), "error");
      } finally {
        setPreviewLoading(false);
      }
    },
    [serviceId, show, t, lang],
  );

  useEffect(() => {
    if (open && selectedCycle) {
      void fetchPreview(selectedCycle);
    }
  }, [open, selectedCycle, fetchPreview]);

  useEffect(() => {
    if (open) {
      setSelectedCycle(allowedBillingCycles[0] ?? 30);
      setRenewalError(null);
    }
  }, [open, allowedBillingCycles]);

  const handleAddToCart = () => {
    if (!preview) return;
    setLoading(true);
    try {
      cartService.removeByServiceId(serviceId);
      cartService.addItem({
        productId,
        productSlug: productId,
        productName,
        categoryId,
        categoryName,
        quantity: 1,
        billingCycle: selectedCycle,
        priceMonthly: 0,
        itemType: "renewal",
        serviceId,
        subscriptionId: preview.subscriptionId,
        daysExtension: selectedCycle,
      });
      show(t("serviceRenewAddedToCart"), "success");
      onClose();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={t("cancel")}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="glass-overlay relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-(--border) shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-5 py-4">
          <h2 className="text-lg font-semibold text-(--text-primary)">{t("serviceRenewTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--surface-soft) disabled:opacity-50"
            aria-label={t("cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <p className="text-sm text-(--text-muted)">{t("serviceRenewDesc")}</p>

          {preview && (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-(--border) bg-(--surface-soft) p-3">
              <div className="text-xs">
                <span className="text-(--text-muted)">{t("serviceRenewCurrentExpiry")}</span>
                <p className="mt-0.5 font-medium text-(--text-primary)">
                  {formatDate(preview.currentPeriodEnd, lang)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs text-(--text-muted)">{t("serviceRenewCycle")}</label>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(Number(e.target.value))}
              className="w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--elizon-primary) focus:outline-none"
            >
              {allowedBillingCycles.map((d) => (
                <option key={d} value={d}>
                  {d} {t("days")}
                </option>
              ))}
            </select>
          </div>

          {previewLoading ? (
            <div className="h-24 animate-pulse rounded-[var(--radius-control)] bg-(--surface-soft)" />
          ) : preview ? (
            <div className="space-y-2 rounded-[var(--radius-control)] border border-(--elizon-primary)/30 bg-(--elizon-primary)/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-(--text-muted)">{t("serviceRenewPrice")}</span>
                <span className="text-sm font-semibold tabular-nums text-(--elizon-primary)">
                  {formatMoney(preview.price, lang)}
                </span>
              </div>
              {typeof preview.promotionSavingsMonthlyApprox === "number" &&
                preview.promotionSavingsMonthlyApprox > 0 && (
                  <p className="text-[11px] leading-snug text-(--text-muted)">
                    {t("serviceRenewPromotionApprox").replace(
                      "{amount}",
                      preview.promotionSavingsMonthlyApprox.toFixed(2),
                    )}
                  </p>
                )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-(--text-muted)">{t("serviceRenewNewExpiry")}</span>
                <span className="text-sm font-medium">{formatDate(preview.newPeriodEnd, lang)}</span>
              </div>
            </div>
          ) : null}

          {renewalError && (
            <div className="rounded-[var(--radius-control)] border border-(--error)/30 bg-(--error)/10 p-3">
              <p className="text-xs text-(--error)">{renewalError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={loading || previewLoading || !preview}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? t("loading") : t("serviceRenewAddToCart")}
          </button>
        </div>
      </div>
    </div>
  );
}
