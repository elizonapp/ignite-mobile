import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Scale } from "lucide-react";

import { LegalMarkdownView } from "../auth/legal-markdown-view";
import { useAuth } from "../AuthProvider";
import { useI18n } from "../../i18n";
import {
  getLegalPage,
  getProfileLegalPages,
  type LegalSlug,
} from "../../lib/legal-content";

type LegalContextValue = {
  openLegal: (slug: LegalSlug) => void;
  openLegalHub: () => void;
};

const LegalContext = createContext<LegalContextValue | null>(null);

type LegalView =
  | { kind: "closed" }
  | { kind: "hub" }
  | { kind: "page"; slug: LegalSlug; fromHub: boolean };

export function LegalProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<LegalView>({ kind: "closed" });

  const openLegal = useCallback((slug: LegalSlug) => {
    setView({ kind: "page", slug, fromHub: false });
  }, []);

  const openLegalHub = useCallback(() => {
    setView({ kind: "hub" });
  }, []);

  const close = useCallback(() => setView({ kind: "closed" }), []);

  const value = useMemo(() => ({ openLegal, openLegalHub }), [openLegal, openLegalHub]);

  return (
    <LegalContext.Provider value={value}>
      {children}
      {view.kind === "hub" ? (
        <LegalHubSheet
          onClose={close}
          onOpenPage={(slug) => setView({ kind: "page", slug, fromHub: true })}
        />
      ) : null}
      {view.kind === "page" ? (
        <LegalPageSheet
          slug={view.slug}
          onBack={view.fromHub ? () => setView({ kind: "hub" }) : close}
          onClose={close}
        />
      ) : null}
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

function LegalHubSheet({
  onClose,
  onOpenPage,
}: {
  onClose: () => void;
  onOpenPage: (slug: LegalSlug) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isBusiness = user?.accountType === "BUSINESS";
  const pages = getProfileLegalPages(isBusiness);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--bg-base)">
      <header className="safe-top safe-x flex shrink-0 items-center gap-3 border-b border-(--border) bg-(--bg-base)/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("back")}
          className="rounded-control p-1.5 text-(--text-secondary) transition-colors hover:bg-(--bg-elevated) hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-(--text-primary)">{t("footerLegal")}</h1>
      </header>
      <div className="safe-bottom safe-x flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <ul className="mx-auto max-w-lg space-y-1">
          {pages.map((page) => (
            <li key={page.slug}>
              <button
                type="button"
                onClick={() => onOpenPage(page.slug)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left text-sm font-medium text-(--text-primary) transition-colors hover:bg-(--surface-soft)"
              >
                <Scale className="size-4 shrink-0 text-(--text-muted)" />
                <span className="min-w-0 flex-1 truncate">{t(page.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LegalPageSheet({
  slug,
  onBack,
  onClose,
}: {
  slug: LegalSlug;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const page = getLegalPage(slug);
  const title = page ? t(page.labelKey) : slug;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--bg-base)">
      <header className="safe-top safe-x flex shrink-0 items-center gap-3 border-b border-(--border) bg-(--bg-base)/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          className="rounded-control p-1.5 text-(--text-secondary) transition-colors hover:bg-(--bg-elevated) hover:text-(--text-primary)"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-(--text-primary)">{title}</h1>
        {onBack !== onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-control px-2 py-1 text-xs font-medium text-(--text-muted) hover:text-(--text-primary)"
          >
            {t("close")}
          </button>
        ) : null}
      </header>
      <div className="safe-bottom safe-x flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <LegalMarkdownView slug={slug} />
      </div>
    </div>
  );
}
