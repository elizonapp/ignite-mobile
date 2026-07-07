import { AUTH_LEGAL_PAGES } from "../../lib/legal-content";
import { useI18n } from "../../i18n";
import { useAuthLegal } from "./auth-legal-context";

export function AuthLegalFooter() {
  const { t } = useI18n();
  const { openLegal } = useAuthLegal();

  return (
    <nav
      aria-label={t("footerLegal")}
      className="mx-auto mt-8 w-full max-w-6xl border-t border-(--border) pt-6 pb-2"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{t("footerLegal")}</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {AUTH_LEGAL_PAGES.map((page) => (
          <li key={page.slug}>
            <button
              type="button"
              onClick={() => openLegal(page.slug)}
              className="cursor-pointer text-xs text-(--text-secondary) transition-colors hover:text-(--primary) hover:underline"
            >
              {t(page.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
