import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Globe, Loader2, Plus, Trash2 } from "lucide-react";

import { DnsListToolbar } from "../components/dns/dns-list-toolbar";
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { isDesktopClient } from "../lib/platform";
import { cn } from '../lib/utils';

type Domain = {
  id: string;
  domain: string;
  cfZoneId?: string | null;
};

type ZoneRecord = {
  id: string;
  name: string;
  type: string;
  ttl: number;
  content: string;
  disabled?: boolean;
  comment?: string | null;
};

type DomainsResponse = { success: boolean; data: Domain[] };
type RecordsResponse = { success: boolean; data: ZoneRecord[] };

export function DomainsScreen() {
  const { t } = useI18n();
  const { show } = useToast();
  const desktop = isDesktopClient();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Domain | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isSavingDomain, setIsSavingDomain] = useState(false);

  const loadDomains = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.domains.list();
      if (data.success) {
        setDomains((data.data ?? []) as Domain[]);
        setError(null);
      }
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadDomains(); }, [loadDomains]);

  const saveDomain = async () => {
    setIsSavingDomain(true);
    try {
      const data = await api.domains.add(newDomain);
      if (data.success) {
        show(t("actionDone"), "success");
        setAddingDomain(false);
        setNewDomain("");
        await loadDomains();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSavingDomain(false);
    }
  };

  if (selected) {
    return (
      <DomainRecordsView
        domain={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (!desktop && addingDomain) {
    return (
      <AddDomainView
        onBack={() => setAddingDomain(false)}
        onDone={() => { setAddingDomain(false); void loadDomains(); }}
      />
    );
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-3 pb-24 pt-2">
        <DnsListToolbar
          addLabel={t("domainAdd")}
          onAdd={() => setAddingDomain((v) => !v)}
          onRefresh={() => void loadDomains()}
          isRefreshing={isLoading}
        />

        {desktop && addingDomain && (
          <div className="glass space-y-3 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("subdomainDomain")}</Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder={t("domainAddPlaceholder")}
                autoCapitalize="off"
                inputMode="url"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setAddingDomain(false)} className="flex-1 rounded-xl">
                {t("cancel")}
              </Button>
              <Button
                onClick={() => void saveDomain()}
                disabled={isSavingDomain || !newDomain.trim()}
                className="btn-primary flex-1 justify-center rounded-xl"
              >
                {isSavingDomain ? <Loader2 className="size-4 animate-spin" /> : t("add")}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">{error}</div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass animate-pulse h-14" />
            ))}
          </div>
        ) : domains.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("domainNoDomains")}</div>
        ) : (
          domains.map((domain) => (
            <button
              key={domain.id}
              type="button"
              onClick={() => setSelected(domain)}
              className="glass glass-hover flex w-full items-center gap-3 p-3 text-left"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--surface-soft) text-(--elizon-primary)">
                <Globe className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--text-primary)">{domain.domain}</p>
              </div>
              <ArrowLeft className="size-4 rotate-180 text-(--text-muted)" />
            </button>
          ))
        )}
      </main>
    </div>
  );
}

function DomainRecordsView({ domain, onBack }: { domain: Domain; onBack: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();
  const [records, setRecords] = useState<ZoneRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRecord, setNewRecord] = useState({ type: "A", name: "", content: "", ttl: 300 });

  const load = useCallback(async () => {
    try {
      const data = await api.domains.records(domain.id);
      if (data.success) setRecords((data.data ?? []) as ZoneRecord[]);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [domain.id]);

  useEffect(() => { void load(); }, [load]);

  const addRecord = async () => {
    try {
      await api.domains.createRecord(domain.id, newRecord);
      setShowAdd(false);
      setNewRecord({ type: "A", name: "", content: "", ttl: 300 });
      show(t("actionDone"), "success");
      void load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const deleteRecord = async (recordId: string) => {
    try {
      await api.domains.deleteRecord(domain.id, recordId);
      setRecords((r) => r.filter((x) => x.id !== recordId));
      show(t("actionDone"), "success");
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const recordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-(--text-primary)">{domain.domain}</h1>
          <p className="text-xs text-(--text-muted)">{t("domainRecords")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg p-1.5 text-(--elizon-primary) hover:bg-(--elizon-primary)/10"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <main className="safe-x safe-bottom flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {showAdd && (
          <div className="glass space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-(--text-muted)">{t("domainRecordType")}</Label>
                <select
                  value={newRecord.type}
                  onChange={(e) => setNewRecord((r) => ({ ...r, type: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
                >
                  {recordTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-(--text-muted)">{t("domainRecordTtl")}</Label>
                <Input
                  type="number"
                  value={newRecord.ttl}
                  onChange={(e) => setNewRecord((r) => ({ ...r, ttl: Number(e.target.value) }))}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-(--text-muted)">{t("domainRecordName")}</Label>
              <Input
                value={newRecord.name}
                onChange={(e) => setNewRecord((r) => ({ ...r, name: e.target.value }))}
                placeholder="@"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-(--text-muted)">{t("domainRecordContent")}</Label>
              <Input
                value={newRecord.content}
                onChange={(e) => setNewRecord((r) => ({ ...r, content: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)} className="flex-1 rounded-xl">{t("cancel")}</Button>
              <Button
                onClick={() => void addRecord()}
                disabled={!newRecord.name || !newRecord.content}
                className="btn-primary flex-1 justify-center rounded-xl"
              >
                {t("add")}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-(--text-muted)" /></div>
        ) : records.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("domainNoRecords")}</div>
        ) : (
          records.map((rec) => (
            <div key={rec.id} className="glass flex items-center gap-3 p-3">
              <span className="rounded-lg bg-(--surface-soft) px-2 py-0.5 text-[10px] font-bold text-(--elizon-primary)">
                {rec.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-(--text-primary)">{rec.name}</p>
                <p className="truncate font-mono text-[10px] text-(--text-muted)">{rec.content}</p>
              </div>
              <span className="shrink-0 text-[10px] text-(--text-muted)">TTL {rec.ttl}</span>
              <button
                type="button"
                onClick={() => void deleteRecord(rec.id)}
                className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error)"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function AddDomainView({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();
  const [domain, setDomain] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      const data = await api.domains.add(domain);
      if (data.success) {
        show(t("actionDone"), "success");
        onDone();
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-(--text-primary)">{t("domainAdd")}</h1>
      </div>
      <main className="safe-x safe-bottom flex-1 space-y-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-(--text-muted)">Domain</Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("domainAddPlaceholder")}
            autoCapitalize="off"
            inputMode="url"
            className="h-10 rounded-xl"
          />
        </div>
        <Button
          onClick={() => void save()}
          disabled={isSaving || !domain.trim()}
          className="btn-primary w-full justify-center rounded-xl py-3"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : t("add")}
        </Button>
      </main>
    </div>
  );
}
