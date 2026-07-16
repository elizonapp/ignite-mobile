import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Ticket } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { formatResourceStatus } from "../../../i18n/format-status";
import { formatDate, formatMoney, looseTranslate } from "../lib";
import type { WalletVoucher } from "../../../api/wallet";

export function VouchersTab() {
  const { t, lang } = useI18n();
  const translate = looseTranslate(t);
  const { show } = useToast();
  const { refresh } = useAuth();

  const [vouchers, setVouchers] = useState<WalletVoucher[]>([]);
  const [promo, setPromo] = useState<{ name: string; percentExtra: number; applyAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

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
  }, [t]);

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
          res.amount != null
            ? t("voucherRedeemedAmount").replace("{amount}", formatMoney(res.amount, lang))
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

  return (
    <section className="glass space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-(--text-primary)">
        <Gift className="size-4 text-(--elizon-primary)" />
        {t("vouchersTitle")}
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

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void redeem();
          }}
          placeholder={t("voucherCodePlaceholder")}
          className="flex-1 rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={!code.trim() || isRedeeming}
          className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isRedeeming ? <Loader2 className="size-4 animate-spin" /> : t("voucherRedeem")}
        </button>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-control)] border border-(--error)/30 p-3 text-sm text-(--error)">
          {error}
        </div>
      ) : isLoading ? (
        <div className="h-12 animate-pulse rounded-[var(--radius-control)] bg-(--surface-soft)" />
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-(--text-muted)">{t("vouchersEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-3 rounded-[var(--radius-control)] border border-(--border) p-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-(--surface-soft) text-(--elizon-primary)">
                <Ticket className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-(--text-primary)">{formatMoney(v.amount, lang)}</p>
                <p className="text-[11px] text-(--text-muted)">{formatDate(v.createdAt, lang)}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  v.status?.toUpperCase() === "REDEEMED"
                    ? "bg-(--success)/15 text-(--success)"
                    : "bg-(--surface-soft) text-(--text-muted)",
                )}
              >
                {formatResourceStatus(v.status ?? "", translate)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
