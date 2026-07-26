import { useState } from "react";
import { Capacitor } from "@capacitor/core";

import { AuthField } from "../components/auth/auth-field";
import { AuthShell } from "../components/auth/auth-shell";
import { useAuth } from "../components/AuthProvider";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n";
import { getApiBaseUrl } from "../lib/config";
import { openHostedFlow } from "../lib/hosted-flow";
import { isMobileNative } from "../lib/platform";

type LoginScreenProps = {
  onRegister?: () => void;
};

/** Android WebView autofill often fills the DOM without updating React state. */
function readLoginForm(form: HTMLFormElement, fallback: {
  email: string;
  password: string;
  twoFactorCode: string;
}) {
  const fd = new FormData(form);
  const email = String(fd.get("email") ?? fallback.email).trim();
  // Strip only trailing CR/LF that some Android keyboards/autofill append
  const password = String(fd.get("password") ?? fallback.password).replace(/[\r\n]+$/g, "");
  const twoFactorCode = String(fd.get("twoFactorCode") ?? fallback.twoFactorCode).replace(/\D/g, "");
  return { email, password, twoFactorCode };
}

export function LoginScreen({ onRegister }: LoginScreenProps) {
  const { t } = useI18n();
  const { login } = useAuth();
  const { show } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLine, setDebugLine] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setDebugLine(null);

    const formValues = readLoginForm(e.currentTarget, { email, password, twoFactorCode });
    // Keep controlled state in sync with what we actually send
    setEmail(formValues.email);
    setPassword(formValues.password);
    if (formValues.twoFactorCode) setTwoFactorCode(formValues.twoFactorCode);

    const native = isMobileNative();
    if (native) {
      const line = [
        `platform=${Capacitor.getPlatform()}`,
        `host=${(() => {
          try {
            return new URL(getApiBaseUrl()).host;
          } catch {
            return "?";
          }
        })()}`,
        `emailLen=${formValues.email.length}`,
        `pwLen=${formValues.password.length}`,
      ].join(" · ");
      console.warn("[elizon.auth.login]", line);
      setDebugLine(line);
    }

    try {
      const result = await login({
        email: formValues.email,
        password: formValues.password,
        twoFactorCode: formValues.twoFactorCode || undefined,
        rememberMe,
      });
      if (result.success) {
        show(t("dashWelcome"), "success");
        return;
      }
      if (result.requiresTwoFactor) {
        setRequires2fa(true);
        setDebugLine(null);
        return;
      }
      setError(result.error);
      if (native) {
        setDebugLine((prev) => `${prev ?? ""} · fail=${result.error}`.trim());
      }
    } finally {
      setBusy(false);
    }
  };

  const reset2fa = () => {
    setRequires2fa(false);
    setTwoFactorCode("");
    setError(null);
    setDebugLine(null);
  };

  const openForgotPassword = () => {
    openHostedFlow(`${getApiBaseUrl()}/auth/forgot-password`, {
      title: t("authForgotPassword"),
    });
  };

  return (
    <AuthShell variant="login">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-(--text-primary)">{t("authLoginTitle")}</h1>
        <p className="mt-2 text-sm text-(--text-secondary)">{t("authLoginSubtitle")}</p>
      </div>

      <form noValidate onSubmit={submit} className="space-y-5" autoComplete="on">
        {!requires2fa ? (
          <>
            <AuthField
              id="login-email"
              name="email"
              label={t("authEmail")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder={t("authEmailPlaceholder")}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
            />

            <AuthField
              id="login-password"
              name="password"
              label={t("authPassword")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              labelAction={
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="cursor-pointer text-xs text-(--primary) hover:underline"
                >
                  {t("authForgotPassword")}
                </button>
              }
            />

            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-(--border) text-(--primary) focus:ring-(--primary)"
              />
              <span className="select-none text-sm text-(--text-secondary)">{t("authRememberMe")}</span>
            </label>
          </>
        ) : (
          <>
            <p className="text-sm text-(--text-secondary)">{t("auth2faSubtitle")}</p>
            <AuthField
              id="login-2fa"
              name="twoFactorCode"
              label={t("auth2faCode")}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              required
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
              onInput={(e) =>
                setTwoFactorCode((e.target as HTMLInputElement).value.replace(/\D/g, ""))
              }
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full cursor-pointer py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {requires2fa ? t("auth2FAVerify") : t("authLogin")}
            </span>
          ) : requires2fa ? (
            t("auth2FAVerify")
          ) : (
            t("authLogin")
          )}
        </button>

        {error && <p className="text-center text-sm text-(--error)">{error}</p>}
        {debugLine && (
          <p className="break-all text-center text-[10px] leading-relaxed text-(--text-muted)">
            {debugLine}
          </p>
        )}

        {requires2fa && (
          <button
            type="button"
            onClick={reset2fa}
            className="w-full cursor-pointer rounded-xl border border-(--border) bg-(--bg-elevated) px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:border-(--primary)/40 hover:bg-(--primary)/5 hover:text-(--text-primary)"
          >
            {t("authBackToLogin")}
          </button>
        )}
      </form>

      {!requires2fa && onRegister && (
        <p className="mt-8 text-center text-sm text-(--text-secondary)">
          {t("authNoAccount")}{" "}
          <button
            type="button"
            onClick={onRegister}
            className="cursor-pointer font-medium text-(--primary) hover:underline"
          >
            {t("authRegister")}
          </button>
        </p>
      )}
    </AuthShell>
  );
}
