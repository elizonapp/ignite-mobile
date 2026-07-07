import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { Copy, DollarSign, Loader2, RefreshCw, Users } from "lucide-react";

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { getApiBaseUrl } from '../lib/config';
import { cn } from '../lib/utils';
import { formatResourceStatus } from "../i18n/format-status";

type CommissionRule = { scope: string; percent: number };

type AffiliateProfile = {
  id: string;
  code: string;
  isActive: boolean;
  payoutEnabled: boolean;
  commissionRules?: CommissionRule[];
  payoutMethod?: { type: string; paypalEmail?: string; iban?: string } | null;
};

type AffiliateSummary = {
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  currency: string;
};

type AffiliateResponse = {
  success: boolean;
  affiliate: AffiliateProfile;
  summary: AffiliateSummary;
  withdrawableBalance: number;
};

type Commission = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

type CommissionsResponse = {
  success: boolean;
  commissions: Commission[];
  total: number;
};

type PayoutMethod = "PAYPAL" | "SEPA";

export function AffiliateScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const [data, setData] = useState<AffiliateResponse | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "commissions" | "payout" | "payoutRequests" | "tax">("overview");
  const [payoutRequests, setPayoutRequests] = useState<
    Array<{ id: string; amount: number; currency: string; status: string; createdAt: string }>
  >([]);
  const [taxInfo, setTaxInfo] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [aff, com, payouts, tax] = await Promise.all([
        api.get<AffiliateResponse>("/api/affiliates/me"),
        api.get<CommissionsResponse>("/api/affiliates/me/commissions", { limit: 20 }),
        api.affiliates.payoutRequests(20).catch(() => ({ success: false, requests: [], total: 0 })),
        api.affiliates.taxInfo().catch(() => ({ success: false, taxInfo: null })),
      ]);
      if (aff.success) setData(aff);
      if (com.success) setCommissions(com.commissions);
      if (payouts.success) setPayoutRequests((payouts.requests ?? []) as typeof payoutRequests);
      if (tax.success) setTaxInfo((tax.taxInfo as Record<string, unknown> | null) ?? null);
      setError(null);
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const fmt = (cents: number, currency = "EUR") =>
    new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);

  const copyLink = () => {
    if (!data?.affiliate.code) return;
    const link = `${getApiBaseUrl()}/?ref=${data.affiliate.code}`;
    void navigator.clipboard.writeText(link);
    show(t("copied"), "success");
  };

  if (isLoading) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-(--text-muted)" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x p-4">
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {error ?? t("unknownError")}
          </div>
        </div>
      </div>
    );
  }

  const { affiliate, summary, withdrawableBalance } = data;

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <div className="safe-x flex gap-1 overflow-x-auto border-b border-(--border) px-4">
        {(["overview", "commissions", "payout", "payoutRequests", "tax"] as const).map((t2) => (
          <button
            key={t2}
            type="button"
            onClick={() => setTab(t2)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
              tab === t2
                ? "border-(--elizon-primary) text-(--elizon-primary)"
                : "border-transparent text-(--text-muted)",
            )}
          >
            {t2 === "overview"
              ? t("dashOverview")
              : t2 === "commissions"
                ? t("affiliateCommissions")
                : t2 === "payout"
                  ? t("affiliatePayoutMethod")
                  : t2 === "payoutRequests"
                    ? t("affiliatePayoutRequests")
                    : t("affiliateTaxInfo")}
          </button>
        ))}
      </div>

      <main className="safe-x flex-1 space-y-4 overflow-y-auto pb-24 px-4 pt-4">
        {tab === "overview" && (
          <>
            <div className="glass p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-(--text-muted)">{t("affiliateCode")}</p>
                  <p className="text-lg font-bold text-(--text-primary)">{affiliate.code}</p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  affiliate.isActive
                    ? "bg-(--success)/15 text-(--success)"
                    : "bg-(--surface-soft) text-(--text-muted)",
                )}>
                  {affiliate.isActive ? t("affiliateActive") : t("affiliateInactive")}
                </span>
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="glass glass-hover flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-(--text-secondary)"
              >
                <Copy className="size-3.5" />
                {t("affiliateLink")}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t("affiliatePending")} value={fmt(summary.totalPending, summary.currency)} color="warning" />
              <StatCard label={t("affiliateApproved")} value={fmt(summary.totalApproved, summary.currency)} color="primary" />
              <StatCard label={t("affiliatePaid")} value={fmt(summary.totalPaid, summary.currency)} color="success" />
              <StatCard label={t("affiliateWithdrawable")} value={fmt(withdrawableBalance, summary.currency)} color="primary" />
            </div>

            {affiliate.commissionRules && affiliate.commissionRules.length > 0 && (
              <div className="glass p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">
                  {t("affiliateCommissions")}
                </p>
                {affiliate.commissionRules.map((rule) => (
                  <div key={rule.scope} className="flex items-center justify-between text-sm">
                    <span className="text-(--text-secondary)">{rule.scope}</span>
                    <span className="font-semibold text-(--elizon-primary)">{rule.percent}%</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "commissions" && (
          <>
            {commissions.length === 0 ? (
              <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("affiliateNoCommissions")}</div>
            ) : (
              commissions.map((com) => (
                <div key={com.id} className="glass flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-(--text-primary)">
                      {fmt(com.amount, com.currency)}
                    </p>
                    <p className="text-[10px] text-(--text-muted)">
                      {new Date(com.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <CommissionBadge status={com.status} />
                </div>
              ))
            )}
          </>
        )}

        {tab === "payout" && (
          <PayoutMethodForm
            current={affiliate.payoutMethod}
            onSaved={() => void load()}
          />
        )}

        {tab === "payoutRequests" && (
          <>
            {payoutRequests.length === 0 ? (
              <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("affiliateNoPayoutRequests")}</div>
            ) : (
              payoutRequests.map((req) => (
                <div key={req.id} className="glass flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-(--text-primary)">{fmt(req.amount, req.currency)}</p>
                    <p className="text-[10px] text-(--text-muted)">
                      {new Date(req.createdAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}
                    </p>
                  </div>
                  <CommissionBadge status={req.status} />
                </div>
              ))
            )}
          </>
        )}

        {tab === "tax" && (
          <div className="glass space-y-3 p-4">
            {!taxInfo ? (
              <p className="text-sm text-(--text-muted)">{t("affiliateTaxInfoEmpty")}</p>
            ) : (
              <>
                {typeof taxInfo.fullName === "string" && taxInfo.fullName && (
                  <TaxRow label={t("affiliateTaxName")} value={taxInfo.fullName} />
                )}
                {typeof taxInfo.companyName === "string" && taxInfo.companyName && (
                  <TaxRow label={t("affiliateTaxCompany")} value={taxInfo.companyName} />
                )}
                {typeof taxInfo.street === "string" && (
                  <TaxRow
                    label={t("affiliateTaxAddress")}
                    value={[taxInfo.street, taxInfo.zip, taxInfo.city].filter(Boolean).join(", ")}
                  />
                )}
                {typeof taxInfo.ustId === "string" && taxInfo.ustId && (
                  <TaxRow label={t("affiliateTaxVatId")} value={taxInfo.ustId} />
                )}
                {typeof taxInfo.taxNumber === "string" && taxInfo.taxNumber && (
                  <TaxRow label={t("affiliateTaxNumber")} value={taxInfo.taxNumber} />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "primary" | "success" | "warning" }) {
  const colorClass = {
    primary: "text-(--elizon-primary)",
    success: "text-(--success)",
    warning: "text-(--warning)",
  }[color];
  return (
    <div className="glass p-3">
      <p className="text-[10px] text-(--text-muted)">{label}</p>
      <p className={cn("mt-0.5 text-base font-bold", colorClass)}>{value}</p>
    </div>
  );
}

function TaxRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="text-right font-medium text-(--text-primary)">{value}</span>
    </div>
  );
}

function CommissionBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const statusKey: Record<string, string> = {
    pending: "affiliatePending",
    approved: "affiliateApproved",
    paid: "affiliatePaid",
  };
  const labelKey = statusKey[status.toLowerCase()];
  const label = labelKey ? t(labelKey as never) : formatResourceStatus(status, t);
  const tone: Record<string, string> = {
    pending: "bg-(--warning)/15 text-(--warning)",
    approved: "bg-(--elizon-primary)/15 text-(--elizon-primary)",
    paid: "bg-(--success)/15 text-(--success)",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone[status.toLowerCase()] ?? "bg-(--surface-soft) text-(--text-muted)")}>
      {label}
    </span>
  );
}

function PayoutMethodForm({
  current,
  onSaved,
}: {
  current: { type: string; paypalEmail?: string; iban?: string } | null | undefined;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { show } = useToast();
  const [method, setMethod] = useState<PayoutMethod>(current?.type === "SEPA" ? "SEPA" : "PAYPAL");
  const [paypalEmail, setPaypalEmail] = useState(current?.paypalEmail ?? "");
  const [iban, setIban] = useState(current?.iban ?? "");
  const [bic, setBic] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      const body = method === "PAYPAL"
        ? { type: "PAYPAL", paypalEmail }
        : { type: "SEPA", iban, bic, accountHolder };
      const data = await api.patch<{ success: boolean; error?: string }>("/api/affiliates/me/payout-method", body);
      if (data.success) {
        show(t("save"), "success");
        onSaved();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["PAYPAL", "SEPA"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={cn(
              "flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors",
              method === m
                ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--elizon-primary)"
                : "border-(--border) text-(--text-muted)",
            )}
          >
            {m === "PAYPAL" ? t("affiliatePaypal") : t("affiliateSepa")}
          </button>
        ))}
      </div>

      {method === "PAYPAL" ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">{t("affiliatePaypalEmail")}</Label>
          <Input value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} inputMode="email" className="h-10 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("affiliateAccountHolder")}</Label>
            <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("affiliateIban")}</Label>
            <Input value={iban} onChange={(e) => setIban(e.target.value)} className="h-10 rounded-xl font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("affiliateBic")}</Label>
            <Input value={bic} onChange={(e) => setBic(e.target.value)} className="h-10 rounded-xl font-mono" />
          </div>
        </>
      )}

      <Button
        onClick={() => void save()}
        disabled={isSaving}
        className="btn-primary w-full justify-center rounded-xl py-3"
      >
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : t("affiliatePayoutMethodUpdate")}
      </Button>
    </div>
  );
}
