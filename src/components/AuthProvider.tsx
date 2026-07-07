import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { resolveApiError } from '../api/resolve-error';
import { resolveCaughtApiError } from '../api/resolve-caught-error';
import { ApiError, api, setSessionToken, clearSessionToken, getSessionToken, initSessionToken } from '../lib/api';
import { mobileTranslate } from '../i18n/mobile-translate';
import type { RegisterPayload } from "../features/auth/use-register";
import type { AuthUser } from "../lib/types";

type LoginPayload = {
  email: string;
  password: string;
  twoFactorCode?: string;
  rememberMe?: boolean;
};

type LoginResult =
  | { success: true; user: AuthUser }
  | { success: false; error: string; requiresTwoFactor?: boolean };

type RegisterResult =
  | { success: true; requiresVerification?: boolean; devActivationCode?: string }
  | { success: false; error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    // Skip refresh if no token is stored (user is definitely not logged in)
    if (!getSessionToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    if (inFlight.current) {
      await inFlight.current;
      return;
    }
    const p = (async () => {
      try {
        const data = await api.auth.me();
        if (data?.success && data.user) {
          setUser(data.user as AuthUser);
        } else {
          clearSessionToken();
          setUser(null);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSessionToken();
        }
        setUser(null);
      } finally {
        setIsLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    await p;
  }, []);

  useEffect(() => {
    void (async () => {
      await initSessionToken();
      await refresh();
    })();
  }, [refresh]);

  // Refresh on focus (matches the web app behavior).
  useEffect(() => {
    if (!user) return;
    const handler = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("focus", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("focus", handler);
    };
  }, [user, refresh]);

  const login = useCallback<AuthContextValue["login"]>(
    async ({ email, password, twoFactorCode, rememberMe }) => {
      try {
        const data = await api.auth.login({ email, password, twoFactorCode, rememberMe: !!rememberMe });

        if (data?.success && data.token && data.user) {
          setSessionToken(data.token, { persist: rememberMe !== false });
          await refresh();
          return { success: true, user: data.user as AuthUser };
        }
        return {
          success: false,
          error: resolveApiError(data, mobileTranslate, { fallbackKey: "authBadCredentials" }),
          requiresTwoFactor: data?.requiresTwoFactor,
        };
      } catch (err) {
        if (err instanceof ApiError) {
          const payload = err.payload as { requiresTwoFactor?: boolean } | null;
          return {
            success: false,
            error: resolveCaughtApiError(err, mobileTranslate, "authBadCredentials"),
            requiresTwoFactor: payload?.requiresTwoFactor,
          };
        }
        return { success: false, error: mobileTranslate("authBadCredentials") };
      }
    },
    [refresh],
  );

  const register = useCallback<AuthContextValue["register"]>(async (data) => {
    try {
      const result = await api.auth.register(data);
      if (result?.success) {
        if (result.token) {
          setSessionToken(result.token, { persist: true });
          await refresh();
        }
        return {
          success: true,
          requiresVerification: result.requiresVerification,
          ...(result.devActivationCode ? { devActivationCode: result.devActivationCode } : {}),
        };
      }
      return {
        success: false,
        error: resolveApiError(result, mobileTranslate, { fallbackKey: "authRegisterError" }),
      };
    } catch (err) {
      return {
        success: false,
        error: resolveCaughtApiError(err, mobileTranslate, "authRegisterError"),
      };
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      clearSessionToken();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, register, logout, refresh }),
    [user, isLoading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
