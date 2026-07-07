import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { api } from "../../../lib/api";
import { getApiBaseUrl } from "../../../lib/config";
import { openExternalUrl } from "../../billing/lib";
import { SettingsNavRow, SettingsSection, SettingsSubView } from "../components";

type AuditEntry = {
  id: string;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
};

export function PrivacySettingsView({
  onBack,
  onDeleteAccount,
}: {
  onBack: () => void;
  onDeleteAccount: () => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { show } = useToast();

  const isBusiness = (user?.accountType ?? "").toUpperCase() === "BUSINESS";
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [dpaActive, setDpaActive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await api.user.auditLog(30);
      if (data.success) setAuditEntries((data.logs ?? []) as AuditEntry[]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
    if (isBusiness) {
      void api.settings.dpaOverview().then((res) => {
        if (res.success) setDpaActive(Boolean(res.active));
      });
    }
  }, [isBusiness, loadAudit]);

  const downloadExport = (format: "pdf" | "txt") => {
    setExporting(true);
    const base = getApiBaseUrl().replace(/\/+$/, "");
    openExternalUrl(`${base}/api/user/gdpr-export?format=${format}`);
    show(t("settingsGdprExportStarted"), "info");
    setTimeout(() => setExporting(false), 800);
  };

  const openDpaInBrowser = () => {
    openExternalUrl(`${getApiBaseUrl().replace(/\/+$/, "")}/dashboard/settings?tab=privacy`);
  };

  return (
    <SettingsSubView title={t("settingsPrivacy")} onBack={onBack}>
      <SettingsSection title={t("settingsDataExport")}>
        <p className="text-xs text-(--text-muted)">{t("settingsDataExportDesc")}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => downloadExport("pdf")}
            disabled={exporting}
            className="btn-primary flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            <Download className="size-4" />
            {t("settingsDownloadPDF")}
          </button>
          <button
            type="button"
            onClick={() => downloadExport("txt")}
            disabled={exporting}
            className="glass glass-hover flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            <FileText className="size-4" />
            {t("settingsDownloadTXT")}
          </button>
        </div>
      </SettingsSection>

      {isBusiness && (
        <SettingsSection title={t("settingsDpaTitle")}>
          <p className="text-xs text-(--text-muted)">{t("settingsDpaDesc")}</p>
          <p className="text-sm font-medium text-(--text-primary)">
            {dpaActive ? t("settingsDpaActive") : t("settingsDpaInactive")}
          </p>
          <button type="button" onClick={openDpaInBrowser} className="btn-secondary w-full rounded-xl py-2.5 text-sm">
            {t("settingsDpaManageInBrowser")}
          </button>
        </SettingsSection>
      )}

      <SettingsSection title={t("settingsAuditLog")}>
        <p className="text-xs text-(--text-muted)">{t("settingsAuditLogDesc")}</p>
        {auditLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-(--text-muted)" />
          </div>
        ) : auditEntries.length === 0 ? (
          <p className="text-sm text-(--text-muted)">{t("settingsAuditLogEmpty")}</p>
        ) : (
          auditEntries.map((e) => (
            <div key={e.id} className="rounded-xl border border-(--border) p-3">
              <p className="text-xs font-medium text-(--text-primary)">{e.action}</p>
              {e.resource && (
                <p className="text-[10px] text-(--text-muted)">
                  {e.resource}
                  {e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ""}
                </p>
              )}
              <p className="text-[10px] text-(--text-muted)">
                {e.ipAddress} · {new Date(e.createdAt).toLocaleString(lang === "de" ? "de-DE" : "en-US")}
              </p>
            </div>
          ))
        )}
      </SettingsSection>

      <SettingsNavRow icon={<FileText className="size-4" />} label={t("settingsDeleteAccount")} danger onClick={onDeleteAccount} />
    </SettingsSubView>
  );
}
