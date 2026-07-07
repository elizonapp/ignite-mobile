import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useI18n } from "../i18n";
import type { ProviderView, RawProviderViewResponse } from "../components/provider/types";

function normalizeView(raw: RawProviderViewResponse): ProviderView | null {
  if (!raw.success || !raw.layout) return null;
  const fields = raw.fields ?? [];
  return {
    providerType: raw.providerType ?? "CUSTOM",
    layout: raw.layout,
    tabs: raw.tabs ?? raw.layout.tabs ?? [],
    fields,
    overviewFields: raw.overviewFields ?? fields,
    actions: raw.actions ?? [],
    widgets: raw.widgets ?? [],
    identity: raw.identity ?? null,
  };
}

export type UseProviderViewResult = {
  view: ProviderView | null;
  loading: boolean;
  /** Localized, user-displayable error message. */
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Fetches the serialized provider ViewModel for a service via
 * `api.services.view(id)` (GET /api/services/:id/view). Returns `view: null`
 * while loading or on error.
 */
export function useProviderView(serviceId: string): UseProviderViewResult {
  const { t } = useI18n();
  const translate = t as unknown as (key: string) => string;
  const [view, setView] = useState<ProviderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.services.view(serviceId);
      if (seq !== requestSeq.current) return;

      const normalized = normalizeView(data);
      if (!normalized) {
        setView(null);
        setError(resolveApiError(data, translate, { fallbackKey: "providerViewLoadError" }));
        return;
      }
      setView(normalized);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setView(null);
      setError(resolveCaughtApiError(err, translate, "providerViewLoadError"));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
    // translate is stable per language; excluded to avoid needless refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  useEffect(() => {
    void load();
    return () => {
      requestSeq.current += 1;
    };
  }, [load]);

  return { view, loading, error, refetch: load };
}
