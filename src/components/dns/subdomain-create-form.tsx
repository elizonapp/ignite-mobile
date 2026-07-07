import { Button } from "../ui/button";
import { useI18n } from "../../i18n";
import {
  RECORD_TYPES,
  SRV_PRESETS,
  canSelectRecordType,
  isPterodactyl,
  type RecordType,
  type SubdomainRecordItem,
  type SubdomainServiceItem,
} from "../../lib/subdomain-helpers";
import { cn } from "../../lib/utils";

export type SubdomainFormState = {
  domainId: string;
  subdomain: string;
  type: RecordType | "";
  serviceId: string;
  cnameTarget: string;
  srvDirectTarget: string;
  srvMode: "preset" | "custom";
  presetId: string;
  srvService: string;
  srvProtocol: "tcp" | "udp";
  port: number;
  priority: number;
  weight: number;
  comment: string;
};

export const defaultSubdomainForm: SubdomainFormState = {
  domainId: "",
  subdomain: "",
  type: "",
  serviceId: "",
  cnameTarget: "",
  srvDirectTarget: "",
  srvMode: "preset",
  presetId: "minecraft",
  srvService: "",
  srvProtocol: "tcp",
  port: 25565,
  priority: 100,
  weight: 100,
  comment: "",
};

const TYPE_COLORS: Record<string, string> = {
  A: "bg-(--success)/10 text-(--success)",
  AAAA: "bg-(--elizon-primary)/10 text-(--elizon-primary)",
  CNAME: "bg-(--accent)/10 text-(--accent)",
  SRV: "bg-(--warning)/10 text-(--warning)",
};

type AllowedDomain = { id: string; domain: string };

function recordTypeLabel(type: RecordType, t: (key: string) => string): string {
  if (type === "A") return t("subdomainRecordTypeA");
  if (type === "AAAA") return t("subdomainRecordTypeAAAA");
  if (type === "CNAME") return t("subdomainRecordTypeCNAME");
  return t("subdomainRecordTypeSRV");
}

type SubdomainCreateFormProps = {
  form: SubdomainFormState;
  setForm: React.Dispatch<React.SetStateAction<SubdomainFormState>>;
  domains: AllowedDomain[];
  eligibleServices: SubdomainServiceItem[];
  records: SubdomainRecordItem[];
  selectedService?: SubdomainServiceItem;
  mode: "inline" | "wizard-service" | "wizard-details";
  busy?: boolean;
  onCancel?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  canNext?: boolean;
  canSubmit?: boolean;
};

export function SubdomainCreateForm({
  form,
  setForm,
  domains,
  eligibleServices,
  records,
  selectedService,
  mode,
  busy = false,
  onCancel,
  onNext,
  onSubmit,
  canNext = false,
  canSubmit = false,
}: SubdomainCreateFormProps) {
  const { t } = useI18n();

  const selectService = (service: SubdomainServiceItem) => {
    const ptero = isPterodactyl(service);
    setForm((f) => ({
      ...f,
      serviceId: service.id,
      type: ptero ? "SRV" : "",
      cnameTarget: "",
      srvDirectTarget: ptero ? (service.ipv4 || service.hostname || "") : "",
      srvMode: "preset",
      presetId: "minecraft",
      port: 25565,
    }));
  };

  const canSelectType = (ty: RecordType) =>
    canSelectRecordType(ty, selectedService, form.serviceId, form.domainId, records);

  const srvTargets = records.filter(
    (r) =>
      ["CNAME", "A", "AAAA"].includes(r.type) &&
      r.serviceId === form.serviceId &&
      r.domainId === form.domainId,
  );

  const cnameTargets = records.filter((r) => r.type !== "SRV");

  const showServiceSection = mode === "inline" || mode === "wizard-service";
  const showDetailsSection = mode === "inline" || mode === "wizard-details";

  return (
    <div className="space-y-4">
      {showServiceSection && (
        <>
          <div className="glass space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("subdomainService")}</p>
            <div className="space-y-2">
              {eligibleServices.length === 0 ? (
                <p className="text-sm text-(--text-muted)">{t("subdomainNoServices")}</p>
              ) : (
                eligibleServices.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectService(s)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                      form.serviceId === s.id
                        ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--text-primary)"
                        : "border-(--border) bg-(--surface-soft) text-(--text-primary)",
                    )}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="font-mono text-[10px] text-(--text-muted)">
                      {isPterodactyl(s) ? "SRV" : s.ipv4 || s.ipv6 || s.hostname || ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {form.serviceId && !isPterodactyl(selectedService) && (
            <div className="glass space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("subdomainRecordType")}</p>
              <div className="grid grid-cols-2 gap-2">
                {RECORD_TYPES.map((ty) => {
                  const enabled = canSelectType(ty);
                  const label = recordTypeLabel(ty, t);
                  return (
                    <button
                      key={ty}
                      type="button"
                      disabled={!enabled}
                      onClick={() => setForm((f) => ({ ...f, type: ty, cnameTarget: "" }))}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-sm font-medium transition-all disabled:opacity-40",
                        form.type === ty
                          ? "border-(--elizon-primary) bg-(--elizon-primary)/10"
                          : "border-(--border) bg-(--surface-soft)",
                      )}
                    >
                      <span className={cn("mr-1.5 inline-flex rounded-full px-2 py-0.5 text-xs", TYPE_COLORS[ty])}>{ty}</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.serviceId && isPterodactyl(selectedService) && (
            <div className="glass p-4">
              <p className="text-sm text-(--text-secondary)">
                <span className={cn("mr-2 inline-flex rounded-full px-2 py-0.5 text-xs", TYPE_COLORS.SRV)}>SRV</span>
                {t("subdomainRecordTypeSRV")}
              </p>
            </div>
          )}
        </>
      )}

      {showDetailsSection && (
        <>
          <div className="glass space-y-3 p-4">
            <div className="space-y-1.5">
              <label className="text-xs text-(--text-muted)">{t("subdomainDomain")}</label>
              {domains.length === 0 ? (
                <p className="text-sm text-(--warning)">{t("subdomainNoDomains")}</p>
              ) : (
                <select
                  value={form.domainId}
                  onChange={(e) => setForm((f) => ({ ...f, domainId: e.target.value, cnameTarget: "" }))}
                  className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2.5 text-sm text-(--text-primary) focus:outline-none"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.domain}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-(--text-muted)">{t("subdomainPrefix")}</label>
              <input
                type="text"
                value={form.subdomain}
                onChange={(e) => setForm((f) => ({ ...f, subdomain: e.target.value.replace(/[^A-Za-z0-9]/g, "") }))}
                placeholder="meinserver"
                className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2.5 font-mono text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            {form.subdomain && form.domainId && (
              <p className="rounded-lg bg-(--surface-soft) px-3 py-2 font-mono text-xs text-(--text-primary)">
                {form.subdomain.toLowerCase()}.{domains.find((d) => d.id === form.domainId)?.domain}
              </p>
            )}
          </div>

          {form.type === "CNAME" && (
            <div className="glass space-y-1.5 p-4">
              <label className="text-xs text-(--text-muted)">{t("subdomainCnameTarget")}</label>
              {cnameTargets.length === 0 ? (
                <p className="text-sm text-(--warning)">{t("subdomainCnameTargetRequired")}</p>
              ) : (
                <select
                  value={form.cnameTarget}
                  onChange={(e) => setForm((f) => ({ ...f, cnameTarget: e.target.value }))}
                  className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2.5 text-sm text-(--text-primary) focus:outline-none"
                >
                  <option value="">—</option>
                  {cnameTargets.map((r) => (
                    <option key={r.id} value={r.fqdn}>{r.fqdn}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {form.type === "SRV" && (
            <div className="glass space-y-3 p-4">
              <div className="flex overflow-hidden rounded-xl border border-(--border)">
                {SRV_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      srvMode: "preset",
                      presetId: p.id,
                      port: p.port,
                      srvProtocol: p.protocol,
                    }))}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium transition-colors",
                      form.srvMode === "preset" && form.presetId === p.id
                        ? "bg-(--surface-soft) text-(--text-primary)"
                        : "text-(--text-muted)",
                    )}
                  >
                    {t(p.labelKey)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, srvMode: "custom", presetId: "" }))}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium transition-colors",
                    form.srvMode === "custom" ? "bg-(--surface-soft) text-(--text-primary)" : "text-(--text-muted)",
                  )}
                >
                  {t("subdomainSrvCustom")}
                </button>
              </div>

              {form.srvMode === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-(--text-muted)">{t("subdomainSrvServiceName")}</label>
                    <input
                      type="text"
                      value={form.srvService}
                      onChange={(e) => setForm((f) => ({ ...f, srvService: e.target.value.replace(/[^a-zA-Z0-9-]/g, "") }))}
                      placeholder="minecraft"
                      className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-(--text-muted)">{t("subdomainSrvProtocol")}</label>
                    <select
                      value={form.srvProtocol}
                      onChange={(e) => setForm((f) => ({ ...f, srvProtocol: e.target.value as "tcp" | "udp" }))}
                      className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) focus:outline-none"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                </div>
              )}

              {isPterodactyl(selectedService) ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-(--text-muted)">{t("subdomainSrvDirectTarget")}</label>
                  <input
                    type="text"
                    value={form.srvDirectTarget}
                    onChange={(e) => setForm((f) => ({ ...f, srvDirectTarget: e.target.value }))}
                    placeholder="123.45.67.89"
                    className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2.5 font-mono text-sm text-(--text-primary) focus:outline-none"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs text-(--text-muted)">{t("subdomainSrvTargetCname")}</label>
                  {srvTargets.length === 0 ? (
                    <p className="rounded-lg bg-(--warning)/10 px-3 py-2 text-xs text-(--warning)">{t("subdomainSrvTargetCnameNone")}</p>
                  ) : (
                    <select
                      value={form.cnameTarget}
                      onChange={(e) => setForm((f) => ({ ...f, cnameTarget: e.target.value }))}
                      className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2.5 text-sm text-(--text-primary) focus:outline-none"
                    >
                      <option value="">—</option>
                      {srvTargets.map((r) => (
                        <option key={r.id} value={r.subdomain}>{r.fqdn} ({r.type})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-(--text-muted)">{t("subdomainSrvPort")}</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || 25565 }))}
                    className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-(--text-muted)">{t("subdomainSrvPriority")}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-(--text-muted)">{t("subdomainSrvWeight")}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.weight}
                    onChange={(e) => setForm((f) => ({ ...f, weight: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2 text-sm text-(--text-primary) focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="glass space-y-1.5 p-4">
            <label className="text-xs text-(--text-muted)">{t("subdomainComment")} ({t("optional")})</label>
            <input
              type="text"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              placeholder="z. B. Minecraft-Server"
              className="w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none"
            />
          </div>
        </>
      )}

      {mode === "wizard-service" && onNext && (
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="btn-primary w-full rounded-xl py-3 text-sm font-medium disabled:opacity-50"
        >
          {t("next")}
        </button>
      )}

      {mode === "wizard-details" && onSubmit && (
        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={onSubmit}
          className="btn-primary w-full rounded-xl py-3 text-sm font-medium disabled:opacity-50"
        >
          {busy ? t("loading") : t("subdomainNewRecord")}
        </button>
      )}

      {mode === "inline" && (onCancel || onSubmit) && (
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="flex-1 rounded-xl">
              {t("cancel")}
            </Button>
          )}
          {onSubmit && (
            <Button
              onClick={onSubmit}
              disabled={busy || !canSubmit}
              className="btn-primary flex-1 justify-center rounded-xl"
            >
              {busy ? t("loading") : t("subdomainNewRecord")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
