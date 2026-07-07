import { useCallback, useEffect, useRef, useState } from "react";

import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProviderView, RawProviderViewResponse } from "../components/provider/types";
import type { ResolvedField } from "../shared/provider-module-types";

export type ProductProviderView = ProviderView & {
  orderFields: ResolvedField[];
};

function normalizeProductView(raw: RawProviderViewResponse & { orderFields?: ResolvedField[] }): ProductProviderView | null {
  if (!raw.success || !raw.layout) return null;
  const fields = raw.fields ?? [];
  return {
    providerType: raw.providerType ?? "CUSTOM",
    layout: raw.layout,
    tabs: raw.tabs ?? raw.layout.tabs ?? [],
    fields,
    overviewFields: raw.overviewFields ?? fields,
    orderFields: raw.orderFields ?? [],
    actions: raw.actions ?? [],
    widgets: raw.widgets ?? [],
    identity: raw.identity ?? null,
  };
}

export function useProductProviderView(categoryKey: string, productSlug: string, enabled = true) {
  const { t } = useI18n();
  const [view, setView] = useState<ProductProviderView | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !categoryKey || !productSlug) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.shop.productView(categoryKey, productSlug);
      if (seq !== requestSeq.current) return;
      const normalized = normalizeProductView(data as RawProviderViewResponse & { orderFields?: ResolvedField[] });
      if (!normalized) {
        setView(null);
        setError(resolveApiError(data, t, { fallbackKey: "providerViewLoadError" }));
        return;
      }
      setView(normalized);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setView(null);
      setError(resolveCaughtApiError(err, t, "providerViewLoadError"));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [categoryKey, productSlug, enabled, t]);

  useEffect(() => {
    void load();
    return () => {
      requestSeq.current += 1;
    };
  }, [load]);

  return { view, loading, error, refetch: load };
}
