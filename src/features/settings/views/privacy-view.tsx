import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { useI18n } from "../../../i18n";
import { api } from "../../../lib/api";
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

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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
  }, [loadAudit]);

  return (
    <SettingsSubView title={t("settingsPrivacy")} onBack={onBack}>
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
