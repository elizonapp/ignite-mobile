import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "../../i18n";
import { useToast } from "../Toast";
import {
  fetchPreorders,
  withdrawPreorderRequest,
  type PreorderListItem,
} from "../../api/preorders";

export function MobilePreordersSection() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const [items, setItems] = useState<PreorderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPreorders();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onWithdraw = async (id: string) => {
    setWithdrawingId(id);
    try {
      const result = await withdrawPreorderRequest(id);
      if (!result.success) {
        show(result.error || t("unknownError"), "error");
        return;
      }
      show(t("preorderWithdrawSuccess"), "success");
      setConfirmId(null);
      await load();
    } finally {
      setWithdrawingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-5 animate-spin text-(--text-muted)" />
      </div>
    );
  }

  if (items.length === 0) return null;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-(--text-primary)">{t("preorderSectionTitle")}</h2>
      <div className="space-y-2">
        {items.map((row) => (
          <div key={row.id} className="glass space-y-2 p-4">
            <p className="text-sm font-semibold text-(--text-primary)">{row.productName}</p>
            <p className="text-xs text-(--text-muted)">
              {t("preorderOrderedAt")}: {fmtDate(row.orderedAt)}
            </p>
            <p className="text-xs text-(--text-secondary)">
              {t("preorderDelivery")}: {row.deliveryLabel}
            </p>
            {row.canWithdraw ? (
              confirmId === row.id ? (
                <div className="space-y-2 rounded-xl border border-(--border) bg-(--bg-elevated) p-3">
                  <p className="text-xs font-medium text-(--text-primary)">
                    {t("preorderWithdrawConfirmTitle")}
                  </p>
                  <p className="text-xs text-(--text-muted)">{t("preorderWithdrawConfirmBody")}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={withdrawingId === row.id}
                      onClick={() => void onWithdraw(row.id)}
                      className="btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {withdrawingId === row.id ? t("loading") : t("preorderWithdraw")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-xl border border-(--border) px-3 py-1.5 text-xs"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(row.id)}
                  className="text-xs font-medium text-(--error) underline-offset-2 hover:underline"
                >
                  {t("preorderWithdraw")}
                </button>
              )
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
