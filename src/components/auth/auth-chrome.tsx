import { useState } from "react";
import { Globe } from "lucide-react";

import { useI18n, type Lang } from "../../i18n";
import { getApiBaseUrl, setApiBaseUrl } from "../../lib/config";
import { useTheme } from "../ThemeProvider";
import { useToast } from "../Toast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function AuthChrome() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <header className="safe-top safe-x shrink-0 border-b border-(--border) bg-(--bg-base)/90 backdrop-blur-sm">
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
        <ServerConfigButton />
      </div>
    </header>
  );
}

function ServerConfigButton() {
  const { t } = useI18n();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [apiBaseUrl, setApiUrlField] = useState(getApiBaseUrl());

  const persist = () => {
    try {
      const next = setApiBaseUrl(apiBaseUrl);
      setApiUrlField(next);
      show(t("save"), "success");
      setOpen(false);
    } catch {
      show(t("unknownError"), "error");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setApiUrlField(getApiBaseUrl());
          setOpen((v) => !v);
        }}
        className="max-w-[10rem] truncate rounded-control border border-(--border) bg-(--bg-elevated) px-3 py-1.5 text-[11px] font-medium text-(--text-muted) transition-colors hover:border-(--primary)/40 hover:text-(--text-secondary)"
      >
        {new URL(getApiBaseUrl()).host}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-surface border border-(--border) bg-(--bg-elevated) p-4 shadow-lg">
          <Label htmlFor="auth-api-url" className="text-xs text-(--text-muted)">
            {t("authServerUrl")}
          </Label>
          <Input
            id="auth-api-url"
            type="url"
            className="mt-1.5"
            value={apiBaseUrl}
            onChange={(e) => setApiUrlField(e.target.value)}
            placeholder={t("authServerUrlHint")}
          />
          <Button onClick={persist} className="btn-primary mt-3 w-full justify-center py-2.5">
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
