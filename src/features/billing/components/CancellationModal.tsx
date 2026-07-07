import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useI18n } from "../../../i18n";

type CancellationModalProps = {
  open: boolean;
  title: string;
  /** Factual, verifiable consequences of the cancellation (AGENTS.md §8.2). */
  consequences: ReactNode[];
  /** Optional single line acknowledging the investment/tenure — factual, no pathos. */
  tenureNote?: string | null;
  confirmLabel: string;
  onConfirm: (feedback: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Optional extra controls rendered above the actions (e.g. immediate vs period-end). */
  options?: ReactNode;
};

/**
 * A single confirmation modal for financially disadvantageous actions.
 * Follows AGENTS.md §8: honest consequences, optional (never required) feedback,
 * one modal only, no dark patterns. The confirm button is clearly labelled and the
 * "keep" path (cancel) is the primary, equally visible action.
 */
export function CancellationModal({
  open,
  title,
  consequences,
  tenureNote,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  options,
}: CancellationModalProps) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={t("cancellationKeep")}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isLoading ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancellation-modal-title"
        className="glass-overlay relative z-10 w-full max-w-lg space-y-4 rounded-xl border border-(--border) p-5 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-(--warning)/15 text-(--warning)">
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="cancellation-modal-title" className="text-lg font-semibold text-(--text-primary)">
              {title}
            </h2>
            {tenureNote && <p className="text-xs text-(--text-muted)">{tenureNote}</p>}
          </div>
        </div>

        <div className="space-y-2 rounded-[var(--radius-control)] bg-(--surface-soft) p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">
            {t("cancellationConsequencesTitle")}
          </p>
          <ul className="space-y-1.5 text-sm text-(--text-secondary)">
            {consequences.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-(--text-muted)" />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {options}

        <div className="space-y-1.5">
          <label htmlFor="cancellation-feedback" className="text-sm font-medium text-(--text-primary)">
            {t("cancellationFeedbackLabel")}{" "}
            <span className="text-xs font-normal text-(--text-muted)">({t("optional")})</span>
          </label>
          <textarea
            id="cancellation-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder={t("cancellationFeedbackPlaceholder")}
            className="w-full resize-none rounded-[var(--radius-control)] border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--text-primary) focus:border-(--primary) focus:outline-none"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onConfirm(feedback)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-xl border border-(--error)/40 px-4 py-2 text-sm font-medium text-(--error) transition-colors hover:bg-(--error)/10 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-primary flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {t("cancellationKeep")}
          </button>
        </div>
      </div>
    </div>
  );
}
