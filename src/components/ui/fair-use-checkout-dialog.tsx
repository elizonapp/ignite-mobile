import { FairUseAcceptLabel } from "./fair-use-accept-label";

type FairUseCheckoutDialogProps = {
  open: boolean;
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  acceptPrefix: string;
  acceptSuffix: string;
  policyLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function FairUseCheckoutDialog({
  open,
  title,
  checked,
  onCheckedChange,
  acceptPrefix,
  acceptSuffix,
  policyLabel,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: FairUseCheckoutDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fair-use-dialog-title"
      onClick={onCancel}
    >
      <div
        className="max-h-[min(90vh,100dvh)] w-full min-w-0 max-w-lg overflow-y-auto rounded-t-2xl border border-(--border) bg-(--bg-base) p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-2xl sm:rounded-2xl sm:p-6 sm:pb-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="fair-use-dialog-title" className="text-lg font-semibold text-(--text-primary)">
          {title}
        </h2>

        <div className="mt-4 flex flex-col gap-4 sm:mt-6">
          <FairUseAcceptLabel
            checked={checked}
            onChange={onCheckedChange}
            acceptPrefix={acceptPrefix}
            acceptSuffix={acceptSuffix}
            policyLabel={policyLabel}
          />

          <div className="flex flex-row items-stretch gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-medium sm:min-h-0 sm:flex-none"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={!checked}
              onClick={onConfirm}
              className="btn-primary inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:flex-none"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
