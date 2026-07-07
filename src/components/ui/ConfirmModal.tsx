import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "./button";
import { cn } from "../../lib/utils";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  destructive?: boolean;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  destructive = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={cancelLabel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="glass-overlay relative z-10 w-full max-w-md space-y-4 rounded-xl border border-(--border) p-5 shadow-lg"
      >
        <div className="space-y-2">
          <h2 id="confirm-modal-title" className="text-lg font-semibold text-(--text-primary)">
            {title}
          </h2>
          {description && <div className="text-sm text-(--text-muted)">{description}</div>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="rounded-xl">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "justify-center rounded-xl",
              destructive ? "bg-(--error) text-white hover:bg-(--error)/90" : "btn-primary",
            )}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
