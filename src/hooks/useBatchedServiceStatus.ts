import { useEffect, useRef, useState } from "react";

import { api } from '../lib/api';

export type LiveStatusEntry = { status: Record<string, unknown> };

export function useBatchedServiceStatus(ids: string[], intervalMs = 30000) {
  const [statuses, setStatuses] = useState<Record<string, LiveStatusEntry>>({});
  const idsKey = ids.join(",");
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!ids.length) {
      setStatuses({});
      return;
    }

    let cancelled = false;
    const fetchOnce = async () => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      try {
        const data = await api.services.statusBatch(ids);
        if (cancelled || controller.signal.aborted) return;
        if (data?.success && data.statuses) {
          const next: Record<string, LiveStatusEntry> = {};
          for (const [id, entry] of Object.entries(data.statuses)) {
            // API returns { status: {metrics}, source: "..." } — unwrap to get the metrics object
            const inner = (entry as { status?: Record<string, unknown> }).status ?? entry;
            next[id] = { status: inner as Record<string, unknown> };
          }
          setStatuses(next);
        }
      } catch {
        // network errors leave the previous statuses in place
      }
    };

    void fetchOnce();
    const handle = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchOnce();
    }, intervalMs);

    return () => {
      cancelled = true;
      inFlight.current?.abort();
      window.clearInterval(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, intervalMs]);

  return statuses;
}
