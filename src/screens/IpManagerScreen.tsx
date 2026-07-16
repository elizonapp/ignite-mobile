import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dice5,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type IpRecord = {
  id: string;
  serviceId: string;
  serviceName: string;
  ipAddress: string;
  type: "A" | "AAAA";
  forwardHostname: string;
  reverseContent: string;
  ipv6SubnetPrefix: string | null;
  ipv6SubnetCidr: number | null;
  isPrimary: boolean;
};

type IpSubnet = {
  serviceId: string;
  serviceName: string;
  prefix: string;
  cidr: number;
};

const PER_PAGE = 8;

const TYPE_COLORS: Record<string, string> = {
  A: "bg-(--success)/15 text-(--success)",
  AAAA: "bg-(--primary)/15 text-(--primary)",
};

function expandIPv6(ip: string): string {
  const cleaned = ip.trim();
  if (!cleaned) return "";
  const addr = cleaned.split("/")[0] ?? cleaned;
  if (!addr.includes(":")) return cleaned;
  let left = "";
  let right = "";
  if (addr.includes("::")) {
    const parts = addr.split("::");
    left = parts[0] ?? "";
    right = parts[1] ?? "";
  } else {
    left = addr;
  }
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 0) return addr;
  const full = [...leftParts, ...Array.from({ length: missing }, () => "0"), ...rightParts];
  return full.map((h) => h.padStart(4, "0")).join(":").toLowerCase();
}

function randomHextet(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRandomIPv6InSubnet(prefix: string, cidr: number): string {
  const normalized = prefix.endsWith("::") ? prefix.slice(0, -2) : prefix.replace(/:$/, "");
  const prefixParts = normalized ? normalized.split(":").filter(Boolean) : [];
  const prefixHextets = Math.ceil(cidr / 16);
  const base = prefixParts.slice(0, prefixHextets);
  while (base.length < prefixHextets) base.push("0");
  const remaining = 8 - prefixHextets;
  const suffix = Array.from({ length: remaining }, () => randomHextet());
  return [...base, ...suffix].join(":");
}

function buildPageNumbers(totalPages: number, currentPage: number): Array<number | "ellipsis"> {
  const pages: Array<number | "ellipsis"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (currentPage > 3) pages.push("ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-(--text-primary)">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Ipv6Tools({
  address,
  subnetPrefix,
  cidr,
  t,
  onCopied,
}: {
  address: string;
  subnetPrefix: string | null;
  cidr: number | null;
  t: (key: keyof import("../i18n/en").Dict) => string;
  onCopied: () => void;
}) {
  const expanded = useMemo(() => expandIPv6(address), [address]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onCopied();
    } catch {
      // clipboard may be unavailable
    }
  };

  return (
    <div className="rounded-xl border border-(--border) bg-(--surface-soft)/50 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-(--text-muted)">
        {t("ipManagerIpv6Tools")}
      </div>
      <div className="space-y-2">
        <ToolRow
          label={t("ipManagerIpv6Expanded")}
          value={expanded}
          onCopy={() => void copy(expanded)}
          copyLabel={t("ipManagerIpv6Copy")}
        />
        {subnetPrefix && cidr != null && (
          <ToolRow
            label={`${t("ipManagerIpv6Subnet")} /${cidr}`}
            value={`${subnetPrefix}/${cidr}`}
            onCopy={() => void copy(`${subnetPrefix}/${cidr}`)}
            copyLabel={t("ipManagerIpv6Copy")}
          />
        )}
      </div>
    </div>
  );
}

function ToolRow({
  label,
  value,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <span className="w-28 shrink-0 text-xs text-(--text-muted)">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-(--border) bg-(--bg-card) px-2 py-1 font-mono text-xs text-(--text-secondary)">
          {value}
        </code>
        <button
          type="button"
          onClick={onCopy}
          title={copyLabel}
          className="inline-flex shrink-0 items-center rounded-lg border border-(--border) p-1.5 text-(--text-primary) hover:bg-(--surface-soft)"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function IpManagerScreen() {
  const { t } = useI18n();
  const { show } = useToast();

  const [records, setRecords] = useState<IpRecord[]>([]);
  const [subnets, setSubnets] = useState<IpSubnet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IpRecord | null>(null);
  const [editReverseContent, setEditReverseContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addServiceId, setAddServiceId] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<IpRecord | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.ipManager.list();
      if (data.success) {
        setRecords((data.data ?? []) as IpRecord[]);
        setSubnets(
          ((data.subnets ?? []) as Array<Omit<IpSubnet, "cidr"> & { cidr: number | string }>).map((subnet) => ({
            ...subnet,
            cidr: Number(subnet.cidr),
          })),
        );
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (record) =>
        record.ipAddress.toLowerCase().includes(q) ||
        record.serviceName.toLowerCase().includes(q) ||
        record.forwardHostname.toLowerCase().includes(q) ||
        record.reverseContent.toLowerCase().includes(q),
    );
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const pageNumbers = useMemo(() => buildPageNumbers(totalPages, safePage), [totalPages, safePage]);

  const selectedSubnet = useMemo(
    () => subnets.find((subnet) => subnet.serviceId === addServiceId) ?? null,
    [subnets, addServiceId],
  );

  const openAddModal = () => {
    setAddServiceId(subnets[0]?.serviceId ?? "");
    setAddAddress("");
    setShowAddModal(true);
  };

  const openEdit = (record: IpRecord) => {
    setEditingRecord(record);
    setEditReverseContent(record.reverseContent);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingRecord || !editReverseContent.trim()) return;
    setIsSaving(true);
    try {
      await api.ipManager.update(editingRecord.id, { reverseContent: editReverseContent.trim() });
      show(t("ipManagerSaved"), "success");
      setShowEditModal(false);
      setEditingRecord(null);
      void load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addIpv6 = async () => {
    if (!addServiceId || !addAddress.trim()) return;
    setIsAdding(true);
    try {
      const data = await api.ipManager.addIpv6({
        serviceId: addServiceId,
        ipv6Address: addAddress.trim(),
      });
      if (data.success) {
        show(t("ipManagerAddIpv6Success"), "success");
        setShowAddModal(false);
        setAddAddress("");
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

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemovingId(removeTarget.id);
    try {
      await api.ipManager.remove(removeTarget.id);
      show(t("ipManagerRemoveSuccess"), "success");
      setRemoveTarget(null);
      void load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-(--text-primary) sm:text-lg">{t("ipManagerTitle")}</h1>
            <p className="mt-1 text-xs text-(--text-muted) sm:text-sm">{t("ipManagerDescription")}</p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            disabled={subnets.length === 0}
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary-alt)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="size-4" />
            {t("ipManagerAddIpv6")}
          </button>
        </div>

        {!isLoading && records.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--text-muted)" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${t("search")}…`}
              className="h-10 w-full rounded-xl border border-(--border) bg-(--bg-elevated) py-2.5 pl-10 pr-4 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--primary) focus:outline-none"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-(--text-secondary) hover:bg-(--bg-elevated)"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            {t("refresh")}
          </button>
        </div>

        {error && (
          <div className="glass border border-(--error)/30 p-3 text-sm text-(--error)">{error}</div>
        )}

        {isLoading ? (
          <div className="glass flex items-center justify-center p-10 text-sm text-(--text-muted)">
            <Loader2 className="mr-2 size-5 animate-spin" />
            {t("ipManagerLoading")}
          </div>
        ) : records.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-(--text-muted)">{t("ipManagerEmpty")}</div>
        ) : filtered.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-(--text-muted)">{t("noResults")}</div>
        ) : (
          <div className="space-y-2">
            {paged.map((record) => {
              const isExpanded = expandedId === record.id;
              return (
                <div key={record.id} className="glass overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold text-(--text-primary)">
                        {record.ipAddress}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          TYPE_COLORS[record.type] ?? "",
                        )}
                      >
                        {record.type}
                      </span>
                      {record.isPrimary && (
                        <span className="shrink-0 rounded-full bg-(--warning)/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-(--warning)">
                          {t("ipManagerPrimary")}
                        </span>
                      )}
                    </div>
                    <span className="hidden max-w-[180px] truncate text-sm text-(--text-secondary) sm:block">
                      {record.serviceName}
                    </span>
                    <ChevronDown
                      className={cn("size-4 shrink-0 text-(--text-muted) transition-transform", isExpanded && "rotate-180")}
                    />
                  </button>

                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200",
                      isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-(--border) px-4 pb-4 pt-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="sm:hidden">
                            <span className="text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                              {t("ipManagerColumnService")}
                            </span>
                            <p className="mt-0.5 truncate text-sm font-medium text-(--text-primary)">
                              {record.serviceName}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                              {t("ipManagerColumnForward")}
                            </span>
                            <p className="mt-0.5 break-all font-mono text-sm text-(--text-secondary)">
                              {record.forwardHostname}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wider text-(--text-muted)">
                              {t("ipManagerColumnReverse")}
                            </span>
                            <p className="mt-0.5 break-all font-mono text-sm text-(--text-secondary)">
                              {record.reverseContent || "—"}
                            </p>
                          </div>
                        </div>

                        {record.type === "AAAA" && (
                          <div className="mt-3">
                            <Ipv6Tools
                              address={record.ipAddress}
                              subnetPrefix={record.ipv6SubnetPrefix}
                              cidr={record.ipv6SubnetCidr}
                              t={t}
                              onCopied={() => show(t("ipManagerIpv6Copied"), "success")}
                            />
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          {record.type === "AAAA" && !record.isPrimary && (
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(record)}
                              disabled={removingId === record.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--error) hover:bg-(--error)/10 disabled:opacity-50"
                            >
                              <Trash2 className="size-3.5" />
                              {removingId === record.id ? t("loading") : t("ipManagerRemoveIp")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) px-3 py-1.5 text-xs font-medium text-(--primary) hover:bg-(--primary)/10"
                          >
                            <Pencil className="size-3.5" />
                            {t("ipManagerEditPtr")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && filtered.length > PER_PAGE && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-(--text-muted)">
              {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)} / {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--surface-soft) disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>
              {pageNumbers.map((entry, index) =>
                entry === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-xs text-(--text-muted)">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    className={cn(
                      "min-w-7 rounded-lg px-1.5 py-1 text-xs font-medium",
                      entry === safePage
                        ? "bg-(--primary) text-white"
                        : "text-(--text-secondary) hover:bg-(--surface-soft)",
                    )}
                  >
                    {entry}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg p-1.5 text-(--text-muted) hover:bg-(--surface-soft) disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {showEditModal && (
        <ModalShell title={t("ipManagerEditPtr")} onClose={() => { setShowEditModal(false); setEditingRecord(null); }}>
          <div className="space-y-4">
            <p className="text-xs text-(--text-muted)">{t("ipManagerEditPtrHint")}</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("ipManagerColumnReverse")}</Label>
              <Input
                value={editReverseContent}
                onChange={(event) => setEditReverseContent(event.target.value)}
                placeholder={t("ipManagerReversePlaceholder")}
                autoCapitalize="off"
                className="h-10 rounded-xl font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowEditModal(false); setEditingRecord(null); }}
                className="flex-1 rounded-xl border border-(--border) px-4 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-soft)"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={isSaving || !editReverseContent.trim()}
                className="btn-primary flex flex-1 items-center justify-center rounded-xl bg-[var(--primary-alt)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? t("loading") : t("save")}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showAddModal && (
        <ModalShell title={t("ipManagerAddIpv6")} onClose={() => { setShowAddModal(false); setAddAddress(""); }}>
          <div className="space-y-4">
            <p className="text-xs text-(--text-muted)">{t("ipManagerAddIpv6Hint")}</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("ipManagerAddIpv6Service")}</Label>
              <select
                value={addServiceId}
                onChange={(event) => { setAddServiceId(event.target.value); setAddAddress(""); }}
                className="h-10 w-full rounded-xl border border-(--border) bg-(--surface-soft) px-3 text-sm text-(--text-primary) focus:outline-none"
              >
                {subnets.map((subnet) => (
                  <option key={subnet.serviceId} value={subnet.serviceId}>
                    {subnet.serviceName} ({subnet.prefix}/{subnet.cidr})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-(--text-muted)">{t("ipManagerAddIpv6Address")}</Label>
              <div className="flex gap-2">
                <Input
                  value={addAddress}
                  onChange={(event) => setAddAddress(event.target.value)}
                  placeholder={selectedSubnet ? `${selectedSubnet.prefix}…` : "2001:db8::1"}
                  autoCapitalize="off"
                  className="h-10 flex-1 rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSubnet) return;
                    setAddAddress(generateRandomIPv6InSubnet(selectedSubnet.prefix, selectedSubnet.cidr));
                  }}
                  disabled={!selectedSubnet}
                  title={t("ipManagerIpv6Generate")}
                  className="rounded-xl border border-(--border) px-3 text-(--text-muted) hover:bg-(--bg-elevated) disabled:opacity-40"
                >
                  <Dice5 className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setAddAddress(""); }}
                className="flex-1 rounded-xl border border-(--border) px-4 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-soft)"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void addIpv6()}
                disabled={isAdding || !addServiceId || !addAddress.trim()}
                className="btn-primary flex flex-1 items-center justify-center rounded-xl bg-[var(--primary-alt)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isAdding ? t("loading") : t("ipManagerAddIpv6Submit")}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      <ConfirmModal
        open={removeTarget != null}
        title={t("ipManagerRemoveIp")}
        description={t("ipManagerRemoveConfirm")}
        confirmLabel={t("ipManagerRemoveIp")}
        cancelLabel={t("cancel")}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
        isLoading={removingId != null}
        destructive
      />
    </div>
  );
}
