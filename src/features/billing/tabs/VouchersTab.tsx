import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Ticket } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { formatDate, formatMoney, looseTranslate, openExternalUrl, resolveApiUrl } from "../lib";
import type { WalletVoucher } from "../../../api/wallet";

function formatVoucherStatus(
  status: string,
  t: (
    key:
      | "walletVoucherStatusUnredeemed"
      | "walletVoucherStatusRedeemed"
      | "walletVoucherStatusRefunded"
  ) => string,
): string {
  if (status === "UNREDEEMED") return t("walletVoucherStatusUnredeemed");
  if (status === "REDEEMED") return t("walletVoucherStatusRedeemed");
  if (status === "REFUNDED") return t("walletVoucherStatusRefunded");
  return status;
}

export function VouchersTab() {
  const { t, lang } = useI18n();
  const translate = looseTranslate(t);
  const { show } = useToast();
  const { user, refresh } = useAuth();
  const isConsumer = (user?.accountType ?? "").toUpperCase() !== "BUSINESS";

  const [vouchers, setVouchers] = useState<WalletVoucher[]>([]);
  const [promo, setPromo] = useState<{ name: string; percentExtra: number; applyAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [withdrawTarget, setWithdrawTarget] = useState<WalletVoucher | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.wallet.vouchers(20, 0);
      if (res.success) {
        setVouchers(res.vouchers ?? []);
        setError(null);
      } else {
        setError(resolveApiError(res, translate, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, translate));
    } finally {
      setIsLoading(false);
    }
  }, [translate]);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const res = await api.wallet.bonusEvent();
        if (res.success && res.event) setPromo(res.event);
      } catch {
        // Promo is optional; ignore load errors.
      }
    })();
  }, [load]);

  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsRedeeming(true);
    try {
      const res = await api.wallet.redeemVoucher(trimmed);
      if (res.success) {
        show(
          res.creditAmount != null
            ? t("voucherRedeemedAmount").replace("{amount}", formatMoney(res.creditAmount, lang))
            : t("voucherRedeemed"),
          "success",
        );
        setCode("");
        void refresh();
        await load();
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setIsRedeeming(false);
    }
  };

  const showVoucherCode = async (voucherId: string) => {
    if (revealedCodes[voucherId]) return;
    setRevealingId(voucherId);
    try {
      const res = await api.wallet.voucherCode(voucherId);
      if (res.success && res.code) {
        setRevealedCodes((prev) => ({ ...prev, [voucherId]: res.code! }));
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setRevealingId(null);
    }
  };

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await api.wallet.withdrawVoucher(withdrawTarget.id);
      if (res.success) {
        show(t("walletWithdrawSuccess"), "success");
        setWithdrawTarget(null);
        void refresh();
        await load();
      } else {
        show(resolveApiError(res, translate, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, translate), "error");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="glass space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
          <Gift className="size-4 text-(--elizon-primary)" />
          {t("walletRedeemTitle")}
        </h2>

        {promo && (
          <div className="rounded-[var(--radius-surface)] border border-(--primary)/30 bg-(--primary)/10 p-3 text-sm text-(--text-primary)">
            {t("walletPromoBanner")
              .replace("{name}", promo.name)
              .replace("{percent}", String(promo.percentExtra))
              .replace(
                "{apply}",
                promo.applyAt === "ON_ISSUE" ? t("walletPromoOnIssue") : t("walletPromoOnRedeem"),
              )}
          </div>
        )}

        {isConsumer ? (
          <p className="text-xs text-(--text-muted)">{t("walletWithdrawalPurchaseHint")}</p>
        ) : null}

        <div className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void redeem();
            }}
            placeholder="XXXXXX-XXXXXX-XXXXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-4 py-3 text-sm uppercase tracking-widest text-(--text-primary) focus:border-(--primary) focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void redeem()}
            disabled={!code.trim() || isRedeeming}
            className="btn-primary inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {isRedeeming ? <Loader2 className="size-4 animate-spin" /> : t("walletRedeemSubmit")}
          </button>
        </div>
      </div>

      <div className="glass space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
          <Ticket className="size-4 text-(--elizon-primary)" />
          {t("walletVoucherList")}
        </h2>

        {error ? (
          <div className="rounded-[var(--radius-control)] border border-(--error)/30 p-3 text-sm text-(--error)">
            {error}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-(--surface-soft)" />
            <div className="h-16 animate-pulse rounded-xl bg-(--surface-soft)" />
          </div>
        ) : vouchers.length === 0 ? (
          <p className="text-sm text-(--text-muted)">{t("walletNoVouchers")}</p>
        ) : (
          <div className="space-y-2">
            {vouchers.map((v) => {
              const unredeemed = v.status?.toUpperCase() === "UNREDEEMED";
              const refunded = v.status?.toUpperCase() === "REFUNDED";
              const revealed = revealedCodes[v.id];
              return (
                <div key={v.id} className="rounded-xl border border-(--border) p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-(--text-primary)">
                        {formatMoney(v.faceValue, lang)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-(--text-muted)">
                        {t("walletValidUntil")}: {formatDate(v.expiresAt, lang)}
                      </p>
                      {v.canWithdraw && v.withdrawUntil ? (
                        <p className="mt-0.5 text-[11px] text-(--text-muted)">
                          {t("walletWithdrawUntil").replace("{date}", formatDate(v.withdrawUntil, lang))}
                        </p>
                      ) : null}
                      {revealed ? (
                        <p className="mt-1.5 font-mono text-xs tracking-wider text-(--text-primary)">
                          {revealed}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        refunded
                          ? "bg-(--error)/15 text-(--error)"
                          : unredeemed
                            ? "bg-(--primary)/15 text-(--primary)"
                            : "bg-(--success)/15 text-(--success)",
                      )}
                    >
                      {formatVoucherStatus(v.status ?? "", t)}
                    </span>
                  </div>
                  {unredeemed ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void showVoucherCode(v.id)}
                        disabled={revealingId === v.id || Boolean(revealed)}
                        className="text-xs text-(--primary) hover:underline disabled:opacity-50"
                      >
                        {revealingId === v.id
                          ? t("loading")
                          : revealed
                            ? t("walletCodeShown")
                            : t("walletShowCode")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = resolveApiUrl(`/api/wallet/vouchers/${v.id}/certificate.pdf`);
                          if (url) openExternalUrl(url, { title: t("walletDownloadPdf") });
                        }}
                        className="text-xs text-(--primary) hover:underline"
                      >
                        {t("walletDownloadPdf")}
                      </button>
                      {v.canWithdraw ? (
                        <button
                          type="button"
                          onClick={() => setWithdrawTarget(v)}
                          className="text-xs text-(--error) hover:underline"
                        >
                          {t("walletWithdraw")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(withdrawTarget)}
        title={t("walletWithdrawConfirmTitle")}
        description={
          withdrawTarget
            ? t("walletWithdrawConfirmDesc").replace(
                "{amount}",
                formatMoney(withdrawTarget.paidAmount, lang),
              )
            : ""
        }
        confirmLabel={t("walletWithdrawConfirm")}
        cancelLabel={t("walletWithdrawCancel")}
        destructive
        isLoading={withdrawing}
        onCancel={() => !withdrawing && setWithdrawTarget(null)}
        onConfirm={() => void confirmWithdraw()}
      />
    </section>
  );
}
