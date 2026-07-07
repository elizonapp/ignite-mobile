import { useCallback, useEffect, useMemo, useState } from "react";
import { IconSearch, IconClose } from "../dashboard/dashboard-icons";

import { useI18n } from "../../i18n";
import { getDesktopOS } from "../../lib/platform";
import { useRouter } from "../Router";
import type { Route } from "../Router";
import { Input } from "../ui/input";

/* Navigationsziele – gleiche Reihenfolge wie Sidebar (Jakobsches Gesetz) */
const entries: { route: Route; labelKey: string }[] = [
  { route: { name: "dashboard" }, labelKey: "tabHome" },
  { route: { name: "servers" }, labelKey: "tabServers" },
  { route: { name: "subdomains" }, labelKey: "subdomainTitle" },
  { route: { name: "domains" }, labelKey: "domainsTitle" },
  { route: { name: "ip-manager" }, labelKey: "ipManagerTitle" },
  { route: { name: "ssh-keys" }, labelKey: "sshKeys" },
  { route: { name: "storage" }, labelKey: "storageTitle" },
  { route: { name: "billing" }, labelKey: "tabBilling" },
  { route: { name: "support" }, labelKey: "tabSupport" },
  { route: { name: "feedback" }, labelKey: "feedbackTitle" },
  { route: { name: "family" }, labelKey: "familyTitle" },
  { route: { name: "settings" }, labelKey: "tabSettings" },
];

export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { t } = useI18n();
  const tAny = t as (key: string) => string;
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const shortcutLabel = getDesktopOS() === "darwin" ? "⌘K" : "Strg+K";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const labelled = entries.map((entry) => ({ ...entry, label: tAny(entry.labelKey) }));
    if (!q) return labelled;
    return labelled.filter((entry) => entry.label.toLowerCase().includes(q));
  }, [query, tAny]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const select = useCallback(
    (route: Route) => {
      close();
      navigate(route);
    },
    [close, navigate],
  );

  const onGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const mod = getDesktopOS() === "darwin" ? event.metaKey : event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        close();
      }
    },
    [close],
  );

  useEffect(() => {
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [onGlobalKeyDown]);

  const onInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        select(results[activeIndex].route);
      }
    },
    [results, activeIndex, select],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full min-w-0 items-center gap-2.5 rounded-control border border-(--border) bg-(--bg-elevated) px-3 py-2 text-left text-sm text-(--text-muted) transition-colors hover:border-(--primary)/40 hover:text-(--text-secondary) ${className ?? ""}`}
        title={`${t("search")} (${shortcutLabel})`}
      >
        <IconSearch className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t("commandPalettePlaceholder")}</span>
        <kbd className="hidden shrink-0 rounded border border-(--border) bg-(--surface-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--text-muted) lg:inline">
          {shortcutLabel}
        </kbd>
      </button>

      {open && (
        <div
          className="glass-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          onClick={close}
        >
          <div
            className="glass w-full max-w-lg p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t("commandPaletteTitle")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-(--text-primary)">{t("commandPaletteTitle")}</p>
              <button
                type="button"
                onClick={close}
                className="rounded-[var(--radius-control)] p-1.5 text-(--text-muted) hover:bg-(--surface-soft)"
                aria-label={t("close")}
              >
                <IconClose className="size-4" />
              </button>
            </div>
            <Input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={t("commandPalettePlaceholder")}
              className="h-10 rounded-[var(--radius-control)]"
            />
            <ul className="mt-3 max-h-64 space-y-0.5 overflow-y-auto">
              {results.length === 0 && (
                <li className="px-3 py-2 text-xs text-(--text-muted)">{t("commandPaletteEmpty")}</li>
              )}
              {results.map((entry, index) => (
                <li key={entry.route.name}>
                  <button
                    type="button"
                    onClick={() => select(entry.route)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors ${
                      index === activeIndex
                        ? "bg-(--primary)/10 text-(--primary)"
                        : "text-(--text-secondary) hover:bg-(--surface-soft)"
                    }`}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-(--text-muted)">{t("commandPaletteStub")}</p>
          </div>
        </div>
      )}
    </>
  );
}
