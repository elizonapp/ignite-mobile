import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "../../../components/AuthProvider";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import { api } from "../../../lib/api";
import {
  canUseClientPush,
  disableMobilePush,
  enableMobilePush,
  getMobilePushPreference,
  getNativePushPermissionState,
  getPushDeniedMessageKey,
} from "../../../lib/push-notifications";
import { SettingsSection, SettingsSubView, SettingsToggleRow } from "../components";

export function NotificationsSettingsView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const showPushToggle = canUseClientPush();

  const [emailNotifications, setEmailNotifications] = useState(Boolean(user?.emailNotifications));
  const [servicePowerActionEmail, setServicePowerActionEmail] = useState(Boolean(user?.servicePowerActionEmailOptIn));
  const [loginNotification, setLoginNotification] = useState(Boolean(user?.loginNotificationEmailOptIn));
  const [notificationSound, setNotificationSound] = useState(user?.notificationSoundEnabled !== false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(Boolean(user?.newsletterOptIn));
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState<"granted" | "denied" | "prompt" | "unsupported">("prompt");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!showPushToggle) return;
    void (async () => {
      const permission = await getNativePushPermissionState();
      setPushPermission(permission);
      if (permission !== "granted") {
        if (getMobilePushPreference()) {
          await disableMobilePush();
        }
        setPushEnabled(false);
        return;
      }
      setPushEnabled(getMobilePushPreference());
    })();
  }, [showPushToggle]);

  const patchSetting = useCallback(
    async (key: string, body: Parameters<typeof api.settings.patchUserSettings>[0], apply: () => void) => {
      setBusy(key);
      try {
        const res = await api.settings.patchUserSettings(body);
        if (res.success) {
          apply();
          await refresh();
        } else {
          show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
        }
      } catch (err) {
        show(resolveCaughtApiError(err, t), "error");
      } finally {
        setBusy(null);
      }
    },
    [refresh, show, t],
  );

  const togglePush = async () => {
    if (!showPushToggle) return;

    const deniedKey = getPushDeniedMessageKey();

    // Cannot enable while OS permission is denied (system dialog will not reappear).
    if (!pushEnabled && pushPermission === "denied") {
      show(t(deniedKey), "error");
      return;
    }

    setBusy("push");
    try {
      if (pushEnabled) {
        await disableMobilePush();
        setPushEnabled(false);
        setPushPermission(await getNativePushPermissionState());
        return;
      }

      const permissionBefore = await getNativePushPermissionState();
      if (permissionBefore === "denied") {
        setPushPermission("denied");
        setPushEnabled(false);
        show(t(deniedKey), "error");
        return;
      }

      const result = await enableMobilePush();
      setPushPermission(result.permission);
      setPushEnabled(result.ok);
      if (!result.ok) {
        if (result.permission === "denied") {
          show(t(getPushDeniedMessageKey()), "error");
        } else {
          show(t("settingsPushNotificationsUnsupported"), "error");
        }
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(null);
    }
  };

  const subscribeNewsletter = async () => {
    setBusy("newsletter");
    try {
      const res = await api.settings.newsletterSubscribe();
      if (res.success) {
        setNewsletterOptIn(true);
        await refresh();
        show(t("settingsSaved"), "success");
      } else {
        show(resolveApiError(res, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsSubView title={t("settingsNotifications")} onBack={onBack}>
      <SettingsSection title={t("settingsNotifications")}>
        {showPushToggle && (
          <SettingsToggleRow
            label={t("settingsPushNotifications")}
            description={
              pushPermission === "denied"
                ? t(getPushDeniedMessageKey())
                : pushPermission === "unsupported"
                  ? t("settingsPushNotificationsUnsupported")
                  : t("settingsPushNotificationsDesc")
            }
            checked={pushEnabled && pushPermission === "granted"}
            disabled={
              busy === "push" ||
              pushPermission === "unsupported" ||
              pushPermission === "denied"
            }
            onChange={() => void togglePush()}
          />
        )}
        <SettingsToggleRow
          label={t("settingsEmailNotifications")}
          description={t("settingsEmailNotificationsDesc")}
          checked={emailNotifications}
          disabled={busy === "emailNotifications"}
          onChange={() =>
            void patchSetting("emailNotifications", { emailNotifications: !emailNotifications }, () =>
              setEmailNotifications((v) => !v),
            )
          }
        />
        <SettingsToggleRow
          label={t("settingsServicePowerActionEmail")}
          description={t("settingsServicePowerActionEmailDesc")}
          checked={servicePowerActionEmail}
          disabled={busy === "servicePowerActionEmail"}
          onChange={() =>
            void patchSetting(
              "servicePowerActionEmail",
              { servicePowerActionEmailOptIn: !servicePowerActionEmail },
              () => setServicePowerActionEmail((v) => !v),
            )
          }
        />
        <SettingsToggleRow
          label={t("settingsLoginNotification")}
          description={t("settingsLoginNotificationDesc")}
          checked={loginNotification}
          disabled={busy === "loginNotification"}
          onChange={() =>
            void patchSetting(
              "loginNotification",
              { loginNotificationEmailOptIn: !loginNotification },
              () => setLoginNotification((v) => !v),
            )
          }
        />
        <SettingsToggleRow
          label={t("settingsNotificationSound")}
          description={t("settingsNotificationSoundDesc")}
          checked={notificationSound}
          disabled={busy === "notificationSound"}
          onChange={() =>
            void patchSetting(
              "notificationSound",
              { notificationSoundEnabled: !notificationSound },
              () => setNotificationSound((v) => !v),
            )
          }
        />
      </SettingsSection>

      <SettingsSection title={t("settingsNewsletter")}>
        {newsletterOptIn ? (
          <p className="text-sm text-(--elizon-primary)">{t("newsletterSubscribed")}</p>
        ) : (
          <button
            type="button"
            onClick={() => void subscribeNewsletter()}
            disabled={busy === "newsletter"}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm disabled:opacity-50"
          >
            {busy === "newsletter" ? <Loader2 className="size-4 animate-spin" /> : t("newsletterSubscribeButton")}
          </button>
        )}
        <p className="text-xs text-(--text-muted)">{t("settingsNewsletterDesc")}</p>
      </SettingsSection>
    </SettingsSubView>
  );
}
