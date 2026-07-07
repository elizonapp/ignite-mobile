import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";

import { DnsListToolbar } from "../components/dns/dns-list-toolbar";
import {
  SubdomainCreateForm,
  defaultSubdomainForm,
  type SubdomainFormState,
} from "../components/dns/subdomain-create-form";
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { isDesktopClient } from "../lib/platform";
import {
  isPterodactyl,
  parseServicesFromListResponse,
  serviceSupportsType,
  type SubdomainRecordItem,
  type SubdomainServiceItem,
} from "../lib/subdomain-helpers";
import { cn } from '../lib/utils';

type SubdomainRecord = SubdomainRecordItem & {
  value: string;
  port: number | null;
  srvService?: string | null;
  srvProtocol?: string | null;
  comment: string | null;
  serviceName: string | null;
};

type AllowedDomain = { id: string; domain: string };

const TYPE_COLORS: Record<string, string> = {
  A: "bg-(--success)/10 text-(--success)",
  AAAA: "bg-(--elizon-primary)/10 text-(--elizon-primary)",
  CNAME: "bg-(--accent)/10 text-(--accent)",
  SRV: "bg-(--warning)/10 text-(--warning)",
};

export function SubdomainsScreen() {
  const { t } = useI18n();
  const { show } = useToast();
  const desktop = isDesktopClient();

  const [records, setRecords] = useState<SubdomainRecord[]>([]);
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [services, setServices] = useState<SubdomainServiceItem[]>([]);
  const [limitUsed, setLimitUsed] = useState(0);
  const [limitMax, setLimitMax] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState<SubdomainFormState>(defaultSubdomainForm);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [subRes, domRes, svcRes] = await Promise.all([
        api.subdomains.list(),
        api.subdomains.allowedDomains(),
        api.services.list(50),
      ]);
      if (subRes.success) {
        setRecords((subRes.data ?? []) as SubdomainRecord[]);
        setLimitUsed(subRes.limitUsed ?? 0);
        setLimitMax(subRes.limitMax ?? 5);
      } else {
        throw new Error(resolveApiError(subRes, t, { fallbackKey: "unknownError" }));
      }

      if (domRes.success) {
        setDomains((domRes.data ?? []) as AllowedDomain[]);
      } else {
        throw new Error(resolveApiError(domRes, t, { fallbackKey: "unknownError" }));
      }

      const svcData = svcRes.servers ?? svcRes.services;
      if (!svcRes.success) {
        throw new Error(resolveApiError(svcRes, t, { fallbackKey: "unknownError" }));
      }
      setServices(parseServicesFromListResponse(svcData));
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const eligibleServices = useMemo(
    () =>
      services.filter(
        (s) =>
          isPterodactyl(s) ||
          serviceSupportsType(s, "A") ||
          serviceSupportsType(s, "AAAA") ||
          serviceSupportsType(s, "CNAME") ||
          serviceSupportsType(s, "SRV"),
      ),
    [services],
  );

  const selectedService = services.find((s) => s.id === form.serviceId);

  const openForm = () => {
    if (domains.length === 0) {
      show(t("subdomainNoDomains"), "error");
      return;
    }
    if (eligibleServices.length === 0) {
      show(t("subdomainNoServices"), "error");
      return;
    }
    if (limitUsed >= limitMax) {
      return;
    }
    setForm({ ...defaultSubdomainForm, domainId: domains[0]?.id ?? "" });
    setWizardStep(0);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setWizardStep(0);
  };

  const canSubmit = () => {
    if (!form.domainId || !form.subdomain.trim() || !form.type || !form.serviceId) return false;
    if (form.type === "CNAME" && !form.cnameTarget) return false;
    if (form.type === "SRV") {
      if (isPterodactyl(selectedService)) return Boolean(form.srvDirectTarget.trim());
      return Boolean(form.cnameTarget);
    }
    return true;
  };

  const canAdvanceWizard = Boolean(
    form.serviceId && (isPterodactyl(selectedService) || form.type),
  );

  const handleCreate = async () => {
    if (!form.domainId || !form.subdomain.trim() || !form.type || !form.serviceId) {
      show(t("fillAllFields"), "error");
      return;
    }
    if (form.subdomain.toLowerCase() === "www") {
      show(t("subdomainReservedWww"), "error");
      return;
    }
    if (!/^[A-Za-z0-9]+$/.test(form.subdomain)) {
      show(t("subdomainInvalidChars"), "error");
      return;
    }
    if (form.type === "CNAME" && !form.cnameTarget) {
      show(t("subdomainCnameTargetRequired"), "error");
      return;
    }
    if (form.type === "SRV" && form.srvMode === "custom" && !form.srvService.trim()) {
      show(t("subdomainSrvServiceName"), "error");
      return;
    }
    if (form.type === "SRV" && isPterodactyl(selectedService) && !form.srvDirectTarget.trim()) {
      show(t("subdomainSrvDirectTargetRequired"), "error");
      return;
    }
    if (form.type === "SRV" && !isPterodactyl(selectedService) && !form.cnameTarget) {
      show(t("subdomainSrvTargetCnameRequired"), "error");
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        domainId: form.domainId,
        subdomain: form.subdomain.trim().toLowerCase(),
        type: form.type,
        serviceId: form.serviceId,
        comment: form.comment.trim() || undefined,
      };
      if (form.type === "CNAME") body.value = form.cnameTarget;
      if (form.type === "SRV") {
        body.port = form.port;
        body.priority = form.priority;
        body.weight = form.weight;
        if (isPterodactyl(selectedService)) {
          body.srvDirectTarget = form.srvDirectTarget.trim();
        } else {
          body.targetCnameSubdomain = form.cnameTarget;
        }
        if (form.srvMode === "preset") {
          body.presetId = form.presetId;
        } else {
          body.srvService = form.srvService.trim() || "minecraft";
          body.srvProtocol = form.srvProtocol;
        }
      }

      const res = await api.subdomains.create(body);
      if (!res.success) {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("subdomainCreated"), "success");
      closeForm();
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.subdomains.delete(id);
      show(t("subdomainDeleted"), "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  if (!desktop && showForm) {
    return (
      <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
        <header className="safe-top safe-x flex items-center gap-2 pb-3 pt-2">
          <button
            type="button"
            onClick={wizardStep === 0 ? closeForm : () => setWizardStep(0)}
            className="rounded-full p-2 text-(--text-secondary) hover:bg-(--surface-soft)"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="flex-1 text-base font-semibold text-(--text-primary)">
            {t("subdomainNewRecord")}
          </h1>
          <span className="text-xs text-(--text-muted)">{wizardStep + 1} / 2</span>
        </header>

        <main className="safe-x flex-1 space-y-4 overflow-y-auto pb-8">
          <SubdomainCreateForm
            form={form}
            setForm={setForm}
            domains={domains}
            eligibleServices={eligibleServices}
            records={records}
            selectedService={selectedService}
            mode={wizardStep === 0 ? "wizard-service" : "wizard-details"}
            busy={busy}
            canNext={canAdvanceWizard}
            canSubmit={canSubmit()}
            onNext={() => setWizardStep(1)}
            onSubmit={() => void handleCreate()}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-3 pb-24 pt-2">
        <div className="glass flex items-center justify-between p-3">
          <span className="text-xs text-(--text-muted)">{t("subdomainLimit")}</span>
          <span className="text-sm font-semibold text-(--text-primary)">{limitUsed} / {limitMax}</span>
        </div>

        <DnsListToolbar
          addLabel={t("subdomainNewRecord")}
          onAdd={() => (showForm && desktop ? closeForm() : openForm())}
          onRefresh={() => void load()}
          isRefreshing={isLoading}
          addDisabled={limitUsed >= limitMax || domains.length === 0 || eligibleServices.length === 0}
        />

        {desktop && showForm && (
          <SubdomainCreateForm
            form={form}
            setForm={setForm}
            domains={domains}
            eligibleServices={eligibleServices}
            records={records}
            selectedService={selectedService}
            mode="inline"
            busy={busy}
            canSubmit={canSubmit()}
            onCancel={closeForm}
            onSubmit={() => void handleCreate()}
          />
        )}

        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">
            {error}
            <button type="button" onClick={() => void load()} className="ml-2 text-xs underline">{t("retry")}</button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass animate-pulse h-16" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-(--text-muted)">{t("subdomainNoRecords")}</div>
        ) : (
          records.map((r) => (
            <div key={r.id} className="glass p-4">
              {deleteTarget === r.id ? (
                <div className="space-y-3">
                  <p className="text-sm text-(--text-primary)">{t("subdomainDeleteConfirm")}</p>
                  <p className="font-mono text-xs text-(--text-muted)">{r.fqdn}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleDelete(r.id)}
                      className="flex-1 rounded-xl border border-(--error)/30 bg-(--error)/10 py-2 text-xs font-medium text-(--error)">
                      {t("delete")}
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(null)}
                      className="flex-1 rounded-xl border border-(--border) py-2 text-xs text-(--text-muted)">
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", TYPE_COLORS[r.type] || "bg-white/5 text-(--text-muted)")}>
                        {r.type}
                      </span>
                      <span className="truncate font-mono text-sm font-medium text-(--text-primary)">{r.fqdn}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-(--text-muted)">
                      {r.serviceName ?? r.serviceId}
                      {r.type === "SRV" && r.port != null ? ` · port ${r.port}` : ""}
                      {r.comment ? ` · ${r.comment}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(r.id)}
                    className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error)"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
