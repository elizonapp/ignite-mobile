import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/utils";

type AppModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible label for the backdrop dismiss control. */
  closeAriaLabel: string;
  closeDisabled?: boolean;
  /** Extra classes for the dialog panel. */
  className?: string;
  /** Extra classes for the overlay shell. */
  overlayClassName?: string;
  /** Max-width utility for the panel (default max-w-lg). */
  maxWidthClassName?: string;
  /** Mobile alignment; desktop always centers. */
  align?: "end" | "center";
};

/**
 * Full-viewport modal shell portaled to document.body.
 * Must portal out of `.app-main` — overflow there clips fixed overlays on Capacitor WebViews,
 * and the bottom nav otherwise stacks above in-tree z-50 dialogs.
 */
export function AppModal({
  open,
  onClose,
  children,
  closeAriaLabel,
  closeDisabled = false,
  className,
  overlayClassName,
  maxWidthClassName = "max-w-lg",
  align = "end",
}: AppModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeDisabled, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex justify-center safe-x",
        "p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
        align === "end" ? "items-end sm:items-center sm:pb-4" : "items-center",
        overlayClassName,
      )}
    >
      <button
        type="button"
        aria-label={closeAriaLabel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeDisabled ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "glass-overlay relative z-10 flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-(--border) shadow-lg",
          "max-h-[min(90dvh,calc(100dvh-2rem))]",
          maxWidthClassName,
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
