import { useEffect, useState } from "react";

import { SkeletonList } from "../components/ui/SkeletonBlock";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

type MonthlyOffer = {
  id: string;
  productName: string;
  couponCode: string | null;
  discountPercent: number;
  expiresAt: string;
};

export function MonthlyOffersScreen() {
  const { t, lang } = useI18n();
  const [offers, setOffers] = useState<MonthlyOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const json = await api.dashboard.monthlyOffers();
        if (cancelled) return;
        if (json?.success && Array.isArray(json.offers)) {
          setOffers(
            json.offers.map((offer) => {
              const row = offer as Record<string, unknown>;
              return {
                id: String(row.id ?? ""),
                productName: String(row.productName ?? row.productId ?? "Produkt"),
                couponCode: typeof row.couponCode === "string" ? row.couponCode : null,
                discountPercent: Number(row.discountPercent ?? 0),
                expiresAt: String(row.expiresAt ?? ""),
              };
            }),
          );
        } else {
          setOffers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-(--text-primary)">{t("monthlyOffersTitle")}</h1>
          <p className="text-sm text-(--text-muted)">{t("monthlyOffersSubtitle")}</p>
        </header>

        {loading ? (
          <SkeletonList count={3} />
        ) : offers.length === 0 ? (
          <div className="glass p-6 text-sm text-(--text-muted)">{t("monthlyOffersEmpty")}</div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <article key={offer.id} className="glass space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-(--text-primary)">{offer.productName}</h2>
                    {offer.expiresAt ? (
                      <p className="mt-1 text-xs text-(--text-muted)">
                        {t("monthlyOffersValidUntil")}{" "}
                        {new Date(offer.expiresAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-(--success)/15 px-2.5 py-1 text-xs font-semibold text-(--success)">
                    -{offer.discountPercent}%
                  </span>
                </div>
                <span className="inline-block rounded-lg border border-(--border) bg-(--bg-elevated) px-3 py-1.5 font-mono text-xs text-(--text-primary)">
                  {offer.couponCode ?? t("monthlyOffersCodeInCheckout")}
                </span>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
