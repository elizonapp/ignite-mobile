import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from '../components/ui/input';
import { SkeletonList } from '../components/ui/SkeletonBlock';
import { ServerCard } from '../components/dashboard/ServerCard';
import { useRouter } from '../components/Router';
import { useServersList } from '../hooks/useServersList';
import { useBatchedServiceStatus } from '../hooks/useBatchedServiceStatus';
import { useI18n } from '../i18n';
import { mergeLiveStatus } from '../lib/normalize';

export function ServersScreen() {
  const { t } = useI18n();
  const { navigate } = useRouter();
  const { isLoading, error, servers, maintenance, reload } = useServersList();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) =>
      [s.name, s.ip, s.location, s.os].join(" ").toLowerCase().includes(q),
    );
  }, [servers, query]);

  const ids = useMemo(() => filtered.slice(0, 20).map((s) => s.id), [filtered]);
  const live = useBatchedServiceStatus(ids);
  const merged = useMemo(
    () => filtered.map((s) => (live[s.id] ? mergeLiveStatus(s, live[s.id]?.status ?? null) : s)),
    [filtered, live],
  );

  const maintenanceById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const n of maintenance) map.set(n.serviceId, true);
    return map;
  }, [maintenance]);

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="h-11 rounded-xl pl-9"
          />
        </div>

        {error ? (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">
            {error}
            <button
              type="button"
              onClick={() => void reload()}
              className="ml-3 text-xs font-medium text-(--elizon-primary) underline-offset-2 hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        ) : isLoading ? (
          <SkeletonList count={4} />
        ) : merged.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("noServers")}</div>
        ) : (
          <div className="space-y-3">
            {merged.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onOpen={(id) => navigate({ name: "server", id })}
                maintenance={maintenanceById.get(server.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
