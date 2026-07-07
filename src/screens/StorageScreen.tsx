import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { HardDrive, RefreshCw, Unlink } from "lucide-react";

import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type Volume = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: string;
  serviceStatus?: string | null;
  mountPoint?: string | null;
  pricePerMonth?: number | null;
  createdAt: string;
  server?: { id: string; name: string } | null;
  subscription?: { id: string } | null;
};

type StorageResponse = {
  success: boolean;
  volumes: Volume[];
};

const statusTone: Record<string, string> = {
  attached: "text-(--success)",
  detached: "text-(--text-muted)",
  provisioning: "text-(--warning)",
  suspended: "text-(--error)",
};

export function StorageScreen() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<StorageResponse>("/api/storage");
      if (data.success) {
        setVolumes(data.volumes);
        setError(null);
      } else {
        setError(t("unknownError"));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const detach = async (id: string) => {
    try {
      await api.patch(`/api/storage/${id}`, { action: "detach" });
      show(t("actionDone"), "success");
      void load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const formatPrice = (cents: number | null | undefined) => {
    if (cents == null) return "—";
    return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-3 pb-24 pt-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          </button>
        </div>

        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">{error}</div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass animate-pulse h-24" />
            ))}
          </div>
        ) : volumes.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("storageNoVolumes")}</div>
        ) : (
          volumes.map((vol) => {
            const statusKey = (vol.status ?? "").toLowerCase();
            return (
              <div key={vol.id} className="glass p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--surface-soft) text-(--elizon-primary)">
                      <HardDrive className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-(--text-primary)">{vol.name}</p>
                      <p className="text-xs text-(--text-muted)">{vol.size} GB · {vol.type}</p>
                    </div>
                  </div>
                  <span className={cn("text-xs font-medium", statusTone[statusKey] ?? "text-(--text-muted)")}>
                    {vol.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-(--text-muted)">
                  <span>
                    {vol.server ? `${t("storageAttachedTo")}: ${vol.server.name}` : t("storageDetached")}
                  </span>
                  <span className="font-medium text-(--text-primary)">{formatPrice(vol.pricePerMonth)}/mo</span>
                </div>

                {vol.mountPoint && (
                  <p className="font-mono text-[10px] text-(--text-muted)">{vol.mountPoint}</p>
                )}

                {vol.status === "attached" && (
                  <button
                    type="button"
                    onClick={() => void detach(vol.id)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-(--text-muted) hover:bg-(--surface-soft)"
                  >
                    <Unlink className="size-3.5" />
                    {t("storageDetach")}
                  </button>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
