import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Bell, CreditCard, Globe, Key, Link2, Loader2, LogOut, MapPin, Moon, Shield, Sun, Trash2, User, Monitor, FileText, AlertTriangle, Ticket,
} from "lucide-react";

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../components/AuthProvider';
import { useRouter } from '../components/Router';
import { useTheme } from '../components/ThemeProvider';
import { useToast } from '../components/Toast';
import { useI18n, type Lang } from '../i18n';
import { api } from '../lib/api';
import { APP_VERSION, getApiBaseUrl, setApiBaseUrl } from '../lib/config';
import { cn } from '../lib/utils';
import { formatUserGreetingName } from '../lib/userName';
import { canManageSavedPaymentMethodsUser } from '../lib/saved-payment-methods';
import { PaymentMethodsTab } from '../features/billing/tabs/PaymentMethodsTab';
import { SettingsNavRow, SettingsSection as SettingsSectionBlock, SettingsSubView } from '../features/settings/components';
import { ProfileSettingsView } from '../features/settings/views/profile-view';
import { NotificationsSettingsView } from '../features/settings/views/notifications-view';
import { AddressesSettingsView } from '../features/settings/views/addresses-view';
import { ConnectionsSettingsView } from '../features/settings/views/connections-view';
import { PrivacySettingsView } from '../features/settings/views/privacy-view';

type SettingsView =
  | "main"
  | "profile"
  | "password"
  | "2fa"
  | "sessions"
  | "notifications"
  | "addresses"
  | "payment-methods"
  | "apikeys"
  | "connections"
  | "privacy"
  | "delete";

// ── Types ─────────────────────────────────────────────────────────────────

type Session = {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt?: string;
  isCurrent?: boolean;
};

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

// ── Main screen ───────────────────────────────────────────────────────────

export function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { show } = useToast();
  const { navigate } = useRouter();
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [view, setView] = useState<SettingsView>("main");

  const showPaymentMethods = canManageSavedPaymentMethodsUser(user);

  const persistApiUrl = () => {
    try {
      setApiBaseUrl(apiUrl);
      show(t("save"), "success");
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const onLogout = async () => {
    await logout();
    show(t("authSignedOut"), "info");
  };

  const displayName = user ? formatUserGreetingName(user) || t("appName") : t("appName");

  if (view === "profile") return <ProfileSettingsView onBack={() => setView("main")} />;
  if (view === "password") return <PasswordChange onBack={() => setView("main")} />;
  if (view === "2fa") return <TwoFactorManagement onBack={() => setView("main")} />;
  if (view === "sessions") return <SessionsView onBack={() => setView("main")} />;
  if (view === "notifications") return <NotificationsSettingsView onBack={() => setView("main")} />;
  if (view === "addresses") return <AddressesSettingsView onBack={() => setView("main")} />;
  if (view === "payment-methods") {
    return (
      <SettingsSubView title={t("walletTabMethods")} onBack={() => setView("main")}>
        <PaymentMethodsTab />
      </SettingsSubView>
    );
  }
  if (view === "apikeys") return <ApiKeysView onBack={() => setView("main")} />;
  if (view === "connections") return <ConnectionsSettingsView onBack={() => setView("main")} />;
  if (view === "privacy") return <PrivacySettingsView onBack={() => setView("main")} onDeleteAccount={() => setView("delete")} />;
  if (view === "delete") return <DeleteAccountView onBack={() => setView("privacy")} />;

  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">

      <main className="safe-x flex-1 space-y-4 pb-24 pt-2">
        <SettingsSectionBlock title={t("settingsAccount")}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-(--text-muted)">{t("settingsSession")}</p>
              <p className="truncate text-sm font-medium text-(--text-primary)">{displayName}</p>
              <p className="truncate text-xs text-(--text-muted)">{user?.email ?? "—"}</p>
            </div>
            <Button variant="ghost" onClick={() => void onLogout()} className="rounded-xl text-(--error) hover:bg-(--error)/10">
              <LogOut className="mr-1 size-4" />
              {t("signOut")}
            </Button>
          </div>

          <SettingsNavRow icon={<User className="size-4" />} label={t("settingsProfile")} onClick={() => setView("profile")} />
          <SettingsNavRow icon={<Bell className="size-4" />} label={t("settingsNotifications")} onClick={() => setView("notifications")} />
          <SettingsNavRow icon={<MapPin className="size-4" />} label={t("settingsAddresses")} hint={t("settingsAddressesDesc")} onClick={() => setView("addresses")} />
          {showPaymentMethods && (
            <SettingsNavRow icon={<CreditCard className="size-4" />} label={t("walletTabMethods")} onClick={() => setView("payment-methods")} />
          )}
        </SettingsSectionBlock>

        <SettingsSectionBlock title={t("settingsSecurity")}>
          <SettingsNavRow icon={<Key className="size-4" />} label={t("settingsChangePassword")} onClick={() => setView("password")} />
          <SettingsNavRow icon={<Shield className="size-4" />} label={t("settings2fa")} onClick={() => setView("2fa")} />
          <SettingsNavRow icon={<Monitor className="size-4" />} label={t("settingsSessions")} onClick={() => setView("sessions")} />
          <SettingsNavRow icon={<Key className="size-4" />} label={t("settingsApiKeys")} onClick={() => setView("apikeys")} />
          <SettingsNavRow icon={<Link2 className="size-4" />} label={t("settingsConnections")} onClick={() => setView("connections")} />
        </SettingsSectionBlock>

        <SettingsSectionBlock title={t("settingsBilling")}>
          <SettingsNavRow
            icon={<Ticket className="size-4" />}
            label={t("walletTabFunding")}
            hint={t("settingsVouchersHint")}
            onClick={() => navigate({ name: "billing" })}
          />
        </SettingsSectionBlock>

        <SettingsSectionBlock title={t("settingsPrivacy")}>
          <SettingsNavRow icon={<FileText className="size-4" />} label={t("settingsPrivacy")} hint={t("settingsPrivacyHint")} onClick={() => setView("privacy")} />
        </SettingsSectionBlock>

        <SettingsSectionBlock title={t("settingsAppearance")}>
          <Row label={t("settingsLanguage")} icon={<Globe className="size-4" />}>
            <ToggleGroup
              options={[{ id: "de", label: "DE" }, { id: "en", label: "EN" }]}
              value={lang}
              onChange={(next) => setLang(next as Lang)}
            />
          </Row>
          <Row label={t("settingsTheme")} icon={theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}>
            <ToggleGroup
              options={[{ id: "dark", label: t("themeDark") }, { id: "light", label: t("themeLight") }]}
              value={theme}
              onChange={(next) => setTheme(next as "dark" | "light")}
            />
          </Row>
        </SettingsSectionBlock>

        <SettingsSectionBlock title={t("settingsApi")}>
          <p className="text-[11px] text-(--text-muted)">{t("settingsApiHint")}</p>
          <div className="flex items-center gap-2">
            <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" className="h-10 rounded-xl" />
          </div>
          <Button onClick={persistApiUrl} className="btn-primary w-full justify-center rounded-xl py-2.5">
            {t("save")}
          </Button>
        </SettingsSectionBlock>

        <SettingsSectionBlock title={t("settingsAbout")}>
          <Row label={t("settingsVersion")}>
            <span className="text-sm text-(--text-muted)">{APP_VERSION}</span>
          </Row>
        </SettingsSectionBlock>
      </main>
    </div>
  );
}

// ── Sessions view ─────────────────────────────────────────────────────────

function SessionsView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { logout } = useAuth();
  const { show } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.auth.sessions();
      if (data.success) setSessions(data.sessions as Session[]);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const logoutAll = async () => {
    try {
      await api.auth.logoutAll();
      await logout();
      show(t("settingsLogoutAllDone"), "success");
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  const revokeSession = async (id: string) => {
    try {
      await api.auth.revokeSession(id);
      setSessions((s) => s.filter((x) => x.id !== id));
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  return (
    <SubView title={t("settingsSessions")} onBack={onBack}>
      <p className="text-xs text-(--text-muted)">{t("settingsSessionsHint")}</p>
      <Button variant="ghost" onClick={() => void logoutAll()} className="w-full justify-center rounded-xl border border-(--border) py-2.5 text-sm text-(--error)">
        {t("settingsLogoutAll")}
      </Button>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-(--text-muted)" /></div>
      ) : sessions.map((s) => (
        <div key={s.id} className="glass flex items-start gap-3 p-3">
          <Monitor className="mt-0.5 size-4 shrink-0 text-(--text-muted)" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-(--text-primary)">{s.userAgent}</p>
            <p className="text-[10px] text-(--text-muted)">
              {s.ipAddress} · {new Date(s.createdAt).toLocaleDateString()}
            </p>
            {s.isCurrent && (
              <span className="rounded-full bg-(--success)/15 px-1.5 py-0.5 text-[9px] font-medium text-(--success)">Current</span>
            )}
          </div>
          {!s.isCurrent && (
            <button type="button" onClick={() => void revokeSession(s.id)} className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error)">
              <LogOut className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </SubView>
  );
}

// ── API Keys view ─────────────────────────────────────────────────────────

function ApiKeysView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.user.apiKeys();
      if (data.success) setKeys(data.apiKeys as ApiKey[]);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    try {
      const data = await api.user.createApiKey(newKeyName.trim());
      if (data.success) {
        setCreatedKey((data.apiKey as { key?: string })?.key ?? data.secret);
        setNewKeyName("");
        void load();
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsCreating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.user.revokeApiKey(id);
      setKeys((k) => k.filter((x) => x.id !== id));
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    }
  };

  return (
    <SubView title={t("settingsApiKeys")} onBack={onBack}>
      {createdKey && (
        <div className="glass border border-(--success)/40 p-3 space-y-2">
          <p className="text-xs font-medium text-(--success)">{t("settingsApiKeyCreated")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-(--bg-elevated) px-2 py-1 font-mono text-xs text-(--text-primary)">
              {createdKey}
            </code>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(createdKey); show(t("copied"), "success"); }} className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--bg-elevated)">
              <Key className="size-4" />
            </button>
          </div>
          <Button variant="ghost" onClick={() => setCreatedKey(null)} className="w-full rounded-xl text-xs">{t("close")}</Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder={t("settingsApiKeyName")} className="h-10 flex-1 rounded-xl" />
        <Button onClick={() => void create()} disabled={isCreating || !newKeyName.trim()} className="btn-primary rounded-xl px-4">
          {isCreating ? <Loader2 className="size-4 animate-spin" /> : t("add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-(--text-muted)" /></div>
      ) : keys.length === 0 ? (
        <div className="glass p-4 text-center text-sm text-(--text-muted)">{t("noItems")}</div>
      ) : keys.map((k) => (
        <div key={k.id} className="glass flex items-center gap-3 p-3">
          <Key className="size-4 shrink-0 text-(--text-muted)" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-(--text-primary)">{k.name}</p>
            <p className="font-mono text-[10px] text-(--text-muted)">{k.keyPrefix}…</p>
          </div>
          <button type="button" onClick={() => void revoke(k.id)} className="shrink-0 rounded-lg p-1.5 text-(--text-muted) hover:bg-(--error)/10 hover:text-(--error)">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
    </SubView>
  );
}

// ── Delete Account view ───────────────────────────────────────────────────

function DeleteAccountView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { logout } = useAuth();
  const { show } = useToast();
  const [password, setPassword] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const check = async () => {
    setIsChecking(true);
    try {
      const data = await api.user.gdprExportCheck();
      setWarnings(data.warnings ?? []);
      setChecked(true);
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsChecking(false);
    }
  };

  const confirm = async () => {
    if (!password.trim()) return;
    setIsDeleting(true);
    try {
      await api.user.gdprExportConfirm(password);
      show(t("settingsDeleteAccountSuccess"), "success");
      await logout();
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SubView title={t("settingsDeleteAccount")} onBack={onBack}>
      <div className="glass border border-(--error)/30 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--error)" />
          <p className="text-xs text-(--error)">{t("settingsDeleteAccountWarning")}</p>
        </div>
      </div>

      {!checked ? (
        <Button onClick={() => void check()} disabled={isChecking} className="w-full justify-center rounded-xl border border-(--error)/40 py-3 text-sm text-(--error)">
          {isChecking ? <Loader2 className="size-4 animate-spin" /> : t("next")}
        </Button>
      ) : (
        <>
          {warnings.length > 0 && (
            <div className="glass space-y-1 p-3">
              {warnings.map((w, i) => <p key={i} className="text-xs text-(--warning)">{w}</p>)}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("settingsDeleteAccountConfirm")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <Button
            onClick={() => void confirm()}
            disabled={isDeleting || !password.trim()}
            className="w-full justify-center rounded-xl bg-(--error) py-3 text-white hover:bg-(--error)/90"
          >
            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : t("settingsDeleteAccount")}
          </Button>
        </>
      )}
    </SubView>
  );
}

// ── Password Change ───────────────────────────────────────────────────────

function PasswordChange({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { show } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (newPassword !== confirmPassword) { show(t("passwordMismatch"), "error"); return; }
    if (newPassword.length < 8) { show(t("passwordTooShort"), "error"); return; }
    setIsSaving(true);
    try {
      const data = await api.auth.changePassword({ currentPassword, newPassword });
      if (data.success) { show(t("save"), "success"); onBack(); }
      else show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SubView title={t("settingsChangePassword")} onBack={onBack}>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("passwordCurrent")}</Label>
        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("passwordNew")}</Label>
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-(--text-muted)">{t("passwordConfirm")}</Label>
        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <Button onClick={() => void save()} disabled={isSaving || !currentPassword || !newPassword || !confirmPassword} className="btn-primary w-full justify-center rounded-xl py-3">
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : t("save")}
      </Button>
    </SubView>
  );
}

// ── 2FA Management ────────────────────────────────────────────────────────

function TwoFactorManagement({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const twoFactorEnabled = !!user?.twoFactorEnabled;
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  const startSetup = async () => {
    setIsSubmitting(true);
    try {
      const data = await api.auth.setup2fa();
      if (data.success) {
        setSetupData({ secret: data.secret, otpauthUrl: data.otpauthUrl });
        setShowSetup(true);
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const enable2fa = async () => {
    if (!verificationCode.trim()) return;
    setIsSubmitting(true);
    try {
      const data = await api.auth.enable2fa(verificationCode);
      if (data.success) {
        setShowSetup(false);
        setVerificationCode("");
        await refresh();
        show(t("save"), "success");
        if (data.backupCodes) show(`${t("twoFactorBackupCodes")}: ${data.backupCodes.join(", ")}`, "info");
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const disable2fa = async () => {
    if (!disableCode.trim() || !disablePassword.trim()) return;
    setIsSubmitting(true);
    try {
      const data = await api.auth.disable2fa(disableCode, disablePassword);
      if (data.success) {
        setShowDisable(false);
        setDisableCode("");
        setDisablePassword("");
        await refresh();
        show(t("save"), "success");
      } else {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SubView title={t("settings2fa")} onBack={onBack}>
      <div className="glass p-4 text-center">
        <Shield className={cn("mx-auto mb-2 size-8", twoFactorEnabled ? "text-green-400" : "text-(--text-muted)")} />
        <p className="text-sm font-medium text-(--text-primary)">{twoFactorEnabled ? t("twoFactorEnabled") : t("twoFactorDisabled")}</p>
        <p className="mt-1 text-xs text-(--text-muted)">{twoFactorEnabled ? t("twoFactorEnabledHint") : t("twoFactorDisabledHint")}</p>
      </div>

      {!twoFactorEnabled && !showSetup && (
        <Button onClick={() => void startSetup()} disabled={isSubmitting} className="btn-primary w-full justify-center rounded-xl py-3">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("twoFactorEnable")}
        </Button>
      )}

      {showSetup && setupData && (
        <div className="glass space-y-3 p-4">
          <p className="text-xs text-(--text-muted)">{t("twoFactorSetupHint")}</p>
          <div className="rounded-lg bg-(--bg-elevated) p-3 text-center">
            <p className="break-all font-mono text-xs text-(--text-primary)">{setupData.secret}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("twoFactorVerificationCode")}</Label>
            <Input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} placeholder="123456" className="h-10 rounded-xl" />
          </div>
          <Button onClick={() => void enable2fa()} disabled={isSubmitting || verificationCode.length !== 6} className="btn-primary w-full justify-center rounded-xl py-3">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("twoFactorVerify")}
          </Button>
        </div>
      )}

      {twoFactorEnabled && !showDisable && (
        <Button onClick={() => setShowDisable(true)} variant="ghost" className="w-full justify-center rounded-xl py-3 text-(--error) hover:bg-(--error)/10">
          {t("twoFactorDisable")}
        </Button>
      )}

      {showDisable && (
        <div className="glass space-y-3 p-4">
          <p className="text-xs text-(--text-muted)">{t("twoFactorDisableHint")}</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("twoFactorVerificationCode")}</Label>
            <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} placeholder="123456" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-(--text-muted)">{t("passwordCurrent")}</Label>
            <Input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <Button onClick={() => void disable2fa()} disabled={isSubmitting || disableCode.length !== 6 || !disablePassword.trim()} className="w-full justify-center rounded-xl py-3 bg-(--error) text-white hover:bg-(--error)/90">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("twoFactorConfirmDisable")}
          </Button>
        </div>
      )}
    </SubView>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────

function SubView({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-(--text-primary)">{title}</h1>
      </div>
      <main className="safe-x safe-bottom flex-1 space-y-4 p-4 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function Row({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-(--text-primary)">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex rounded-full border border-(--border) bg-(--surface-soft) p-0.5">
      {options.map((opt) => (
        <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === opt.id ? "bg-(--primary-alt) text-white shadow-sm" : "text-(--text-muted) hover:text-(--text-primary)",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

