import { Globe } from "lucide-react";

import { useI18n, type Lang } from "../../i18n";
import { useTheme } from "../ThemeProvider";

export function AuthChrome() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <header className="safe-top safe-x relative z-40 shrink-0 border-b border-(--border) bg-(--bg-base)/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setLang(lang === "de" ? "en" : ("de" as Lang))}
          className="rounded-control border border-(--border) bg-(--bg-elevated) px-3 py-1.5 text-[11px] font-medium text-(--text-secondary) transition-colors hover:border-(--primary)/40 hover:text-(--text-primary)"
        >
          <Globe className="mr-1 inline size-3.5" />
          {lang.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="rounded-control border border-(--border) bg-(--bg-elevated) px-3 py-1.5 text-[11px] font-medium text-(--text-secondary) transition-colors hover:border-(--primary)/40 hover:text-(--text-primary)"
        >
          {theme === "dark" ? t("themeLight") : t("themeDark")}
        </button>
      </div>
    </header>
  );
}
