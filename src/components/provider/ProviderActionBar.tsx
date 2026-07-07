import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { useToast } from "../Toast";
import { api } from "../../lib/api";
import { resolveApiError } from "../../api/resolve-error";
import { resolveCaughtApiError } from "../../api/resolve-caught-error";
import { cn } from "../../lib/utils";
import { useProviderT } from "./use-provider-t";
import { resolveActionIcon } from "./icon-map";
import type { ActionDispatchResponse, SerializedAction } from "./types";

type Props = {
  serviceId: string;
  actions: SerializedAction[];
  /** Service name — required for confirms with `requireResourceName` (AGENTS.md §7.2). */
  resourceName?: string;
  onCompleted?: (actionKey: string, result: ActionDispatchResponse) => void;
  className?: string;
};

/**
 * Renders serialized ActionBinding[] as buttons with loading state and confirm
 * modals. Destructive actions (with a confirm spec) are ordered last and
 * rendered as red outline buttons (AGENTS.md §3.4).
 */
export function ProviderActionBar({ serviceId, actions, resourceName, onCompleted, className }: Props) {
  const t = useProviderT();
  const { show } = useToast();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<SerializedAction | null>(null);
  const [nameInput, setNameInput] = useState("");

  const sortedActions = useMemo(() => {
    const visible = actions.filter((a) => a.visible !== false);
    return [...visible.filter((a) => !a.confirm), ...visible.filter((a) => a.confirm)];
  }, [actions]);

  const execute = async (action: SerializedAction) => {
    setPendingKey(action.key);
    try {
      const data = await api.services.action(serviceId, action.key);
      if (!data?.success) {
        show(resolveApiError(data, t, { fallbackKey: "providerActionError" }), "error");
        return;
      }
      show(data.message || t("actionDone"), "success");
      onCompleted?.(action.key, data);
    } catch (err) {
      show(resolveCaughtApiError(err, t, "providerActionError"), "error");
    } finally {
      setPendingKey(null);
    }
  };

  const handleClick = (action: SerializedAction) => {
    if (action.confirm) {
      setNameInput("");
      setConfirmFor(action);
      return;
    }
    void execute(action);
  };

  const closeConfirm = () => {
    setConfirmFor(null);
    setNameInput("");
  };

  const confirmAndExecute = async () => {
    if (!confirmFor) return;
    const action = confirmFor;
    closeConfirm();
    await execute(action);
  };

  if (sortedActions.length === 0) return null;

  const needsNameInput = Boolean(confirmFor?.confirm?.requireResourceName);
  const nameMatches = !needsNameInput || (resourceName != null && nameInput === resourceName);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {sortedActions.map((action) => {
          const Icon = resolveActionIcon(action.icon);
          const isPending = pendingKey === action.key;
          const destructive = Boolean(action.confirm);
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => handleClick(action)}
              disabled={action.disabled || pendingKey !== null}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                destructive
                  ? "border border-(--error)/60 text-(--error) hover:bg-(--error)/10"
                  : "glass text-(--text-primary) hover:bg-white/5",
              )}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              {t(action.labelKey)}
            </button>
          );
        })}
      </div>

      {confirmFor?.confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label={t(confirmFor.confirm.cancelLabelKey)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeConfirm}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="glass-overlay relative z-10 w-full max-w-md space-y-4 rounded-xl border border-(--border) p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-(--text-primary)">{t(confirmFor.confirm.titleKey)}</h2>
              <button
                type="button"
                onClick={closeConfirm}
                aria-label={t(confirmFor.confirm.cancelLabelKey)}
                className="shrink-0 rounded-lg p-1 text-(--text-muted) hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-sm text-(--text-muted)">{t(confirmFor.confirm.messageKey)}</p>

            {needsNameInput ? (
              <label className="block text-[10px] uppercase tracking-wide text-(--text-muted)">
                {t("providerConfirmTypeName").replace("{name}", resourceName ?? "")}
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  className="mt-1.5 min-h-11 w-full rounded-[var(--radius-control)] border border-(--border) bg-(--bg-base) px-3 py-2 text-sm normal-case tracking-normal text-(--text-primary) outline-none focus:ring-1 focus:ring-(--error)"
                />
              </label>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirm}
                className="min-h-11 rounded-xl border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text-primary) hover:bg-white/5"
              >
                {t(confirmFor.confirm.cancelLabelKey)}
              </button>
              <button
                type="button"
                onClick={() => void confirmAndExecute()}
                disabled={!nameMatches}
                className="min-h-11 rounded-xl bg-(--error) px-4 py-2.5 text-sm font-medium text-white hover:bg-(--error)/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t(confirmFor.confirm.confirmLabelKey)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
