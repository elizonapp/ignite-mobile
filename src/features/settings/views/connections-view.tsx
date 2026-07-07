import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import { getApiBaseUrl } from "../../../lib/config";
import { openExternalUrl } from "../../billing/lib";
import { SettingsSection, SettingsSubView, SettingsToggleRow } from "../components";

export function ConnectionsSettingsView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [discordLinked, setDiscordLinked] = useState(false);
  const [supportConsent, setSupportConsent] = useState(false);
  const [publicRoleConsent, setPublicRoleConsent] = useState(false);
  const [linkToken, setLinkToken] = useState("");
  const [ssoLinks, setSsoLinks] = useState<Array<{ id: string; domain: string; displayName: string | null; externalEmail: string | null }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [discordRes, ssoRes] = await Promise.all([api.settings.discordState(), api.settings.ssoState()]);
      if (discordRes.success) {
        setDiscordLinked(Boolean(discordRes.linked));
        setSupportConsent(Boolean(discordRes.supportConsent));
        setPublicRoleConsent(Boolean(discordRes.publicRoleConsent));
      }
      if (ssoRes.success) {
        setSsoLinks(ssoRes.accountLinks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const redeemDiscord = async () => {
    if (!linkToken.trim()) return;
    setBusy(true);
    try {
      const res = await api.settings.linkDiscord(linkToken.trim());
      if (res.success) {
        setLinkToken("");
        show(t("connectionsDiscordLinked"), "success");
        await load();
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const unlinkDiscord = async () => {
    setBusy(true);
    try {
      await api.settings.unlinkDiscord();
      show(t("connectionsDiscordUnlinked"), "success");
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(false);
    }
  };

  const patchDiscord = async (body: Record<string, unknown>) => {
    try {
      await api.settings.patchDiscord(body);
      await load();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const openSsoManage = () => {
    openExternalUrl(`${getApiBaseUrl().replace(/\/+$/, "")}/dashboard/settings?tab=connections`);
  };

  return (
    <SettingsSubView title={t("settingsConnections")} onBack={onBack}>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-(--text-muted)" />
        </div>
      ) : (
        <>
          <SettingsSection title="Discord">
            {discordLinked ? (
              <div className="space-y-3">
                <p className="text-sm text-(--success)">{t("connectionsDiscordLinked")}</p>
                <SettingsToggleRow
                  label={t("connectionsSupportConsent")}
                  description={t("connectionsSupportConsentDesc")}
                  checked={supportConsent}
                  onChange={() => void patchDiscord({ supportConsent: !supportConsent })}
                />
                <SettingsToggleRow
                  label={t("connectionsPublicRoleConsent")}
                  description={t("connectionsPublicRoleConsentDesc")}
                  checked={publicRoleConsent}
                  onChange={() => void patchDiscord({ publicRoleConsent: !publicRoleConsent })}
                />
                <Button variant="ghost" onClick={() => void unlinkDiscord()} disabled={busy} className="w-full rounded-xl text-(--error)">
                  <Unlink className="mr-2 size-4" />
                  {t("connectionsDiscordUnlink")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-(--text-muted)">{t("connectionsDiscordHint")}</p>
                <Input value={linkToken} onChange={(e) => setLinkToken(e.target.value)} placeholder={t("connectionsDiscordTokenPlaceholder")} className="h-10 rounded-xl" />
                <Button onClick={() => void redeemDiscord()} disabled={busy || !linkToken.trim()} className="btn-primary w-full justify-center rounded-xl py-2.5">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t("connectionsDiscordLink")}
                </Button>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="SSO">
            {ssoLinks.length === 0 ? (
              <p className="text-sm text-(--text-muted)">{t("connectionsSsoEmpty")}</p>
            ) : (
              ssoLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-2 rounded-xl border border-(--border) p-3">
                  <Link2 className="size-4 text-(--elizon-primary)" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{link.displayName ?? link.domain}</p>
                    <p className="truncate text-xs text-(--text-muted)">{link.externalEmail ?? link.domain}</p>
                  </div>
                </div>
              ))
            )}
            <Button variant="ghost" onClick={openSsoManage} className="w-full rounded-xl text-sm">
              {t("connectionsSsoManageInBrowser")}
            </Button>
          </SettingsSection>
        </>
      )}
    </SettingsSubView>
  );
}
