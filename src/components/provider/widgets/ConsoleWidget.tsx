import { Monitor } from "lucide-react";

import { isElectron } from "../../../lib/platform";
import { useProviderT } from "../use-provider-t";
import type { ProviderWidgetProps } from "../types";

/**
 * Mobile port of the "console-vnc" / "console-terminal" widgets. The live
 * console is desktop-first; here we surface an entry point to the dedicated
 * console screen and hint when it is desktop-only.
 */
export default function ConsoleWidget({ context }: ProviderWidgetProps) {
  const t = useProviderT();
  const onOpenConsole = context?.onOpenConsole;

  return (
    <section className="glass p-4">
      <h3 className="text-sm font-semibold text-(--text-primary)">{t("consoleTitle")}</h3>
      <p className="mt-1 text-xs text-(--text-muted)">
        {isElectron() ? t("consoleConnecting") : t("consoleDesktopOnly")}
      </p>
      <button
        type="button"
        onClick={() => onOpenConsole?.()}
        disabled={!onOpenConsole}
        className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Monitor className="size-4" />
        {t("serverConsole")}
      </button>
    </section>
  );
}
