import { useCallback, useEffect, useState } from "react";
import { Briefcase, CreditCard, Loader2, Wallet } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { CancellationModal } from "../components/CancellationModal";
import { formatDate, formatMoney, openExternalUrl } from "../lib";
import type { BusinessFundContract, BusinessFundOffer } from "../../../api/business";

export function BusinessFundTab() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { refresh } = useAuth();

  const [contract, setContract] = useState<BusinessFundContract | null>(null);
  const [offer, setOffer] = useState<BusinessFundOffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.business.fund();
      if (res.success) {
        setContract(res.contract);
        setOffer(res.pendingOffer);
        setError(null);
      } else {
        setError(resolveApiError(res, t, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async (paymentMethod: "mollie" | "guthaben") => {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await api.business.acceptFund(offer.id, paymentMethod);
      if (res.success) {
        if (res.checkoutUrl) {
          openExternalUrl(res.checkoutUrl);
          show(t("businessFundAcceptRedirect"), "info");
        } else {
          show(t("businessFundAccepted"), "success");
          void refresh();
        }
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      const res = await api.business.cancelFund(contract.id);
      if (res.success) {
        show(t("businessFundCanceled"), "success");
        setShowCancel(false);
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <div className="glass h-32 animate-pulse" />;
  }

  if (error) {
    return <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">{error}</div>;
  }

  const inBindingPeriod = !!contract?.bindingEndDate && new Date(contract.bindingEndDate) > new Date();

  return (
    <div className="space-y-3">
      {offer && (
        <section className="glass space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
            <Briefcase className="size-4 text-(--elizon-primary)" />
            {t("businessFundOfferTitle")}
          </h2>
          <div className="space-y-1.5 text-sm">
            <Row label={t("businessFundCommitment")} value={formatMoney(offer.commitmentAmount, lang)} />
            <Row label={t("businessFundPrice")} value={formatMoney(offer.price, lang)} />
            <Row label={t("businessFundOvercharge")} value={`${offer.overchargeFeePercent}%`} />
            <Row label={t("businessFundBinding")} value={`${offer.bindingMonths} ${t("months")}`} />
          </div>
          {offer.adminNote && <p className="text-xs text-(--text-muted)">{offer.adminNote}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void accept("mollie")}
              disabled={busy}
              className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              {t("businessFundAcceptCard")}
            </button>
            <button
              type="button"
              onClick={() => void accept("guthaben")}
              disabled={busy}
              className="glass glass-hover inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-(--text-primary) disabled:opacity-50"
            >
              <Wallet className="size-4" />
              {t("businessFundAcceptBalance")}
            </button>
          </div>
        </section>
      )}

      {contract && contract.status === "ACTIVE" ? (
        <section className="glass space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
              <Briefcase className="size-4 text-(--elizon-primary)" />
              {t("businessFundActiveTitle")}
            </h2>
            <span className="rounded-full bg-(--success)/15 px-2 py-0.5 text-[10px] font-medium text-(--success)">
              {t("businessFundActive")}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label={t("businessFundCommitment")} value={formatMoney(contract.commitmentAmount, lang)} />
            <Row label={t("businessFundUsage")} value={formatMoney(contract.currentUsage, lang)} />
            <Row label={t("businessFundOvercharge")} value={`${contract.overchargeFeePercent}%`} />
            {contract.bindingEndDate && (
              <Row label={t("businessFundBindingUntil")} value={formatDate(contract.bindingEndDate, lang)} />
            )}
          </div>
          {inBindingPeriod ? (
            <p className="rounded-[var(--radius-control)] bg-(--surface-soft) p-3 text-xs text-(--text-muted)">
              {t("businessFundBindingNote").replace(
                "{date}",
                contract.bindingEndDate ? formatDate(contract.bindingEndDate, lang) : "—",
              )}
            </p>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-(--error)/40 px-3 py-1.5 text-xs font-medium text-(--error) transition-colors hover:bg-(--error)/10"
              >
                {t("businessFundCancel")}
              </button>
            </div>
          )}
        </section>
      ) : contract && contract.status !== "ACTIVE" && !offer ? (
        <section className="glass p-4 text-sm text-(--text-muted)">
          {t("businessFundPendingReview")}
        </section>
      ) : !offer ? (
        <section className="glass p-6 text-center text-sm text-(--text-muted)">{t("businessFundNone")}</section>
      ) : null}

      <CancellationModal
        open={showCancel}
        title={t("businessFundCancelTitle")}
        consequences={[
          t("businessFundCancelConsequenceBenefit").replace(
            "{amount}",
            contract ? formatMoney(contract.commitmentAmount, lang) : "—",
          ),
          t("businessFundCancelConsequenceOvercharge"),
        ]}
        confirmLabel={t("businessFundCancelConfirm")}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setShowCancel(false)}
        isLoading={busy}
      />
    </div>
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
