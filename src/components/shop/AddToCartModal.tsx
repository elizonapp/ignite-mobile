import { useI18n } from "../../i18n";

type AddToCartModalProps = {
  open: boolean;
  onClose: () => void;
  onGoToCheckout: () => void;
};

export function AddToCartModal({ open, onClose, onGoToCheckout }: AddToCartModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-cart-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--bg-base) p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-to-cart-modal-title" className="mb-4 text-lg font-semibold text-(--text-primary)">
          {t("addToCartModalTitle")}
        </h2>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onGoToCheckout} className="btn-primary rounded-xl py-3 px-4 text-sm font-semibold">
            {t("addToCartGoToCart")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary rounded-xl py-3 px-4 text-sm font-medium"
          >
            {t("addToCartStayHere")}
          </button>
        </div>
      </div>
    </div>
  );
}
