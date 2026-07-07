import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { LegalMarkdownSheet } from "../auth/legal-markdown-sheet";
import type { LegalSlug } from "../../lib/legal-content";

type LegalContextValue = {
  openLegal: (slug: LegalSlug) => void;
};

const LegalContext = createContext<LegalContextValue | null>(null);

export function LegalProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<LegalSlug | null>(null);

  const openLegal = useCallback((slug: LegalSlug) => {
    setActiveSlug(slug);
  }, []);

  const value = useMemo(() => ({ openLegal }), [openLegal]);

  return (
    <LegalContext.Provider value={value}>
      {children}
      <LegalMarkdownSheet slug={activeSlug} onClose={() => setActiveSlug(null)} />
    </LegalContext.Provider>
  );
}

export function useLegal() {
  const ctx = useContext(LegalContext);
  if (!ctx) throw new Error("useLegal must be used inside <LegalProvider>");
  return ctx;
}

/** Splits `acceptFairUsePolicy` into prefix/suffix around `{link}`. */
export function splitAcceptFairUsePolicy(t: (key: string) => string) {
  const parts = t("acceptFairUsePolicy").split("{link}");
  return { prefix: parts[0] ?? "", suffix: parts[1] ?? "" };
}
