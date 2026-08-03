import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "./button";
import { AppModal } from "./AppModal";
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
  return (
    <AppModal
      open={open}
      onClose={onCancel}
      closeAriaLabel={cancelLabel}
      closeDisabled={isLoading}
      maxWidthClassName="max-w-md"
      className="space-y-4 p-5"
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
    </AppModal>
  );
}
