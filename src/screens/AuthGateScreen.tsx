import { useState } from "react";

import { AuthChrome } from "../components/auth/auth-chrome";
import { AuthLegalFooter } from "../components/auth/auth-legal-footer";
import { AuthLegalProvider } from "../components/auth/auth-legal-context";
import { AuthPageGlow } from "../components/auth/auth-page-glow";
import { LoginScreen } from "./LoginScreen";
import { RegisterScreen } from "./RegisterScreen";
import { isDesktopClient } from "../lib/platform";

export function AuthGateScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const desktop = isDesktopClient();

  return (
    <div className="relative flex min-h-dvh flex-col bg-(--bg-base)">
      <AuthPageGlow />
      <AuthLegalProvider>
        <AuthChrome />
        <main className="safe-bottom relative flex flex-1 flex-col overflow-y-auto px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex flex-1 flex-col">
            {mode === "login" || !desktop ? (
              <LoginScreen onRegister={desktop ? () => setMode("register") : undefined} />
            ) : (
              <RegisterScreen onLogin={() => setMode("login")} />
            )}
          </div>
          <AuthLegalFooter />
        </main>
      </AuthLegalProvider>
    </div>
  );
}
