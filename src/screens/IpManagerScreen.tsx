import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Dice5, Network, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type IpRecord = {
  id: string;
  serviceId?: string | null;
  serviceName?: string | null;
  ipAddress: string;
  type: "A" | "AAAA" | string;
  reverseContent?: string | null;
  forwardHostname?: string | null;
  ipv6SubnetPrefix?: string | null;
  ipv6SubnetCidr?: number | null;
  isPrimary?: boolean;
};

type IpSubnet = {
  serviceId: string;
  serviceName: string;
  prefix: string;
  cidr: string;
};

type IpResponse = {
  success: boolean;
  data?: IpRecord[];
  subnets?: IpSubnet[];
  error?: string;
};

const PAGE_SIZE = 8;

type View = "list" | "edit-ptr" | "add-ipv6";

function generateRandomIpv6InSubnet(prefix: string, cidr: string): string {
  const cidrNum = parseInt(cidr, 10);
  const [netPart = ""] = prefix.split("/");
  const parts = netPart.split(":");
  while (parts.length < 8) parts.push("0");
  const hostGroups = Math.ceil((128 - cidrNum) / 16);
  for (let i = 8 - hostGroups; i < 8; i++) {
    parts[i] = Math.floor(Math.random() * 0xffff).toString(16);
  }
  return parts.join(":");
}

export function IpManagerScreen() {
  const { t } = useI18n();
  const { show } = useToast();
  const [records, setRecords] = useState<IpRecord[]>([]);
  const [subnets, setSubnets] = useState<IpSubnet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [editingRecord, setEditingRecord] = useState<IpRecord | null>(null);
  const [ptrContent, setPtrContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Add IPv6 state
  const [selectedSubnet, setSelectedSubnet] = useState("");
  const [ipv6Address, setIpv6Address] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.ipManager.list();
      if (data.success) {
        setRecords((data.data ?? []) as IpRecord[]);
        setSubnets((data.subnets ?? []) as IpSubnet[]);
        setError(null);
      } else {
        setError(resolveApiError(data, t, { fallbackKey: "unknownError" }));
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const openEditPtr = (record: IpRecord) => {
    setEditingRecord(record);
    setPtrContent(record.reverseContent ?? "");
    setView("edit-ptr");
  };

  const savePtr = async () => {
    if (!editingRecord) return;
    setIsSaving(true);
    try {
      await api.ipManager.update(editingRecord.id, { reverseContent: ptrContent });
      show(t("ipManagerSaved"), "success");
      setView("list");
      void load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteIpv6 = async (record: IpRecord) => {
    try {
      await api.ipManager.delete(record.id);
      show(t("deleted"), "success");
      void load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const addIpv6 = async () => {
    if (!selectedSubnet || !ipv6Address) {
      show(t("ipManagerAddIpv6Hint"), "error");
      return;
    }
    const subnet = subnets.find((s) => `${s.serviceId}:${s.prefix}` === selectedSubnet);
    if (!subnet) return;
    setIsAdding(true);
    try {
      const data = await api.ipManager.addIpv6({
        serviceId: subnet.serviceId,
        ipv6Address,
      });
      if (data.success) {
        show(t("ipManagerAddIpv6Success"), "success");
        setView("list");
        setIpv6Address("");
        setSelectedSubnet("");
        void load();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsAdding(false);
    }
  };

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.ipAddress.toLowerCase().includes(q) ||
      (r.serviceName ?? "").toLowerCase().includes(q) ||
      (r.forwardHostname ?? "").toLowerCase().includes(q) ||
      (r.reverseContent ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ---- Edit PTR view ----
  if (view === "edit-ptr" && editingRecord) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setView("list")} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("ipManagerEditPtr")}</h1>
        </div>
        <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
          <div className="glass p-3 space-y-1">
            <p className="font-mono text-xs font-medium text-(--text-primary)">{editingRecord.ipAddress}</p>
            {editingRecord.serviceName && (
              <p className="text-[10px] text-(--text-muted)">{editingRecord.serviceName}</p>
            )}
            {editingRecord.forwardHostname && (
              <p className="text-[10px] text-(--text-muted)">{editingRecord.forwardHostname}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("ipManagerPtrContent")}</Label>
            <Input
              value={ptrContent}
              onChange={(e) => setPtrContent(e.target.value)}
              placeholder="hostname.example.com"
              autoCapitalize="off"
              className="h-10 rounded-xl font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setView("list")} className="flex-1 rounded-xl">
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void savePtr()}
              disabled={isSaving}
              className="btn-primary flex-1 justify-center rounded-xl"
            >
              {isSaving ? <span className="animate-spin">⟳</span> : t("save")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ---- Add IPv6 view ----
  if (view === "add-ipv6") {
    const subnet = subnets.find((s) => `${s.serviceId}:${s.prefix}` === selectedSubnet);
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setView("list")} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold text-(--text-primary)">{t("ipManagerAddIpv6")}</h1>
        </div>
        <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("ipManagerSubnet")}</Label>
            <select
              value={selectedSubnet}
              onChange={(e) => { setSelectedSubnet(e.target.value); setIpv6Address(""); }}
              className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
            >
              <option value="">—</option>
              {subnets.map((s) => (
                <option key={`${s.serviceId}:${s.prefix}`} value={`${s.serviceId}:${s.prefix}`}>
                  {s.prefix}/{s.cidr} ({s.serviceName})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("ipManagerIpv6Address")}</Label>
            <div className="flex gap-2">
              <Input
                value={ipv6Address}
                onChange={(e) => setIpv6Address(e.target.value)}
                placeholder="2a01:..."
                autoCapitalize="off"
                className="h-10 flex-1 rounded-xl font-mono"
              />
              {subnet && (
                <button
                  type="button"
                  onClick={() => setIpv6Address(generateRandomIpv6InSubnet(subnet.prefix, subnet.cidr))}
                  className="rounded-xl border border-(--border) px-3 text-(--text-muted) hover:bg-(--bg-elevated)"
                  title={t("generate")}
                >
                  <Dice5 className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setView("list")} className="flex-1 rounded-xl">
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void addIpv6()}
              disabled={isAdding || !selectedSubnet || !ipv6Address}
              className="btn-primary flex-1 justify-center rounded-xl"
            >
              {isAdding ? <span className="animate-spin">⟳</span> : t("add")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-3 pb-24 pt-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-(--text-muted)" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder={t("search")}
              className="h-9 w-full rounded-xl border border-(--border) bg-(--surface-soft) pl-8 pr-3 text-xs text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--elizon-primary)"
            />
          </div>
          {subnets.length > 0 && (
            <button
              type="button"
              onClick={() => setView("add-ipv6")}
              className="flex items-center gap-1.5 rounded-xl bg-(--elizon-primary)/10 px-3 py-2 text-xs font-medium text-(--elizon-primary)"
            >
              <Plus className="size-3.5" />
              {t("ipManagerAddIpv6")}
            </button>
          )}
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

        {subnets.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("ipManagerSubnet")}</h2>
            {subnets.map((s) => (
              <div key={`${s.serviceId}-${s.prefix}`} className="glass flex items-center justify-between p-3">
                <div>
                  <p className="font-mono text-xs font-medium text-(--text-primary)">{s.prefix}/{s.cidr}</p>
                  <p className="text-[10px] text-(--text-muted)">{s.serviceName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(`${s.prefix}/${s.cidr}`).catch(() => {}); show(t("copied"), "success"); }}
                  className="rounded-lg p-1 text-(--text-muted) hover:bg-(--bg-elevated)"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            ))}
          </section>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass animate-pulse h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">
            {search ? t("noItems") : t("ipManagerNoIps")}
          </div>
        ) : (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">
              {t("ipManagerTitle")} · {filtered.length}
            </h2>
            {paginated.map((rec) => (
              <div key={rec.id} className="glass flex w-full items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => openEditPtr(rec)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg text-white text-[10px] font-bold",
                    rec.type === "A" ? "bg-(--success)/20 text-(--success)" : "bg-(--primary)/20 text-(--primary)",
                  )}>
                    <Network className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono text-xs font-medium text-(--text-primary) truncate">{rec.ipAddress}</p>
                      <span className={cn(
                        "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold",
                        rec.type === "A" ? "bg-(--success)/15 text-(--success)" : "bg-(--primary)/15 text-(--primary)",
                      )}>
                        {rec.type}
                      </span>
                      {rec.isPrimary && (
                        <span className="shrink-0 rounded bg-(--elizon-primary)/15 px-1 py-0.5 text-[9px] font-semibold text-(--elizon-primary)">
                          {t("primary")}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-(--text-muted)">
                      {rec.reverseContent || rec.forwardHostname || rec.serviceName || "—"}
                    </p>
                  </div>
                </button>
                {rec.type === "AAAA" && !rec.isPrimary && (
                  <button
                    type="button"
                    onClick={() => { if (confirm(t("deleteConfirm"))) void deleteIpv6(rec); }}
                    className="shrink-0 rounded-lg p-1.5 text-(--error)/60 hover:bg-(--error)/10 hover:text-(--error)"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-(--text-secondary) disabled:opacity-30 hover:bg-(--bg-elevated)"
                >
                  ← {t("previous")}
                </button>
                <span className="text-xs text-(--text-muted)">{page + 1} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-(--text-secondary) disabled:opacity-30 hover:bg-(--bg-elevated)"
                >
                  {t("next")} →
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
