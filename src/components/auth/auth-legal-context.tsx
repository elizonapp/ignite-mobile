import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { LegalSlug } from "../../lib/legal-content";
import { LegalMarkdownSheet } from "./legal-markdown-sheet";

type AuthLegalContextValue = {
  openLegal: (slug: LegalSlug) => void;
};

const AuthLegalContext = createContext<AuthLegalContextValue | null>(null);

export function AuthLegalProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<LegalSlug | null>(null);

  const openLegal = useCallback((slug: LegalSlug) => {
    setActiveSlug(slug);
  }, []);

  const value = useMemo(() => ({ openLegal }), [openLegal]);

  return (
    <AuthLegalContext.Provider value={value}>
      {children}
      <LegalMarkdownSheet slug={activeSlug} onClose={() => setActiveSlug(null)} />
    </AuthLegalContext.Provider>
  );
}

export function useAuthLegal() {
  const ctx = useContext(AuthLegalContext);
  if (!ctx) throw new Error("useAuthLegal must be used inside <AuthLegalProvider>");
  return ctx;
}
