import { FairUseAcceptLabel } from "./fair-use-accept-label";
import { AppModal } from "./AppModal";

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
  return (
    <AppModal
      open={open}
      onClose={onCancel}
      closeAriaLabel={cancelLabel}
      overlayClassName="bg-black/60 p-0 sm:p-4 sm:pb-4"
      className="rounded-t-2xl border-(--border) bg-(--bg-base) p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:rounded-2xl sm:p-6 sm:pb-6"
      maxWidthClassName="max-w-lg"
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
    </AppModal>
  );
}
