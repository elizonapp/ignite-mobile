import { AppModal } from "../ui/AppModal";
import { useI18n } from "../../i18n";

type AddToCartModalProps = {
  open: boolean;
  onClose: () => void;
  onGoToCheckout: () => void;
};

export function AddToCartModal({ open, onClose, onGoToCheckout }: AddToCartModalProps) {
  const { t } = useI18n();

  return (
    <AppModal
      open={open}
      onClose={onClose}
      closeAriaLabel={t("cancel")}
      align="center"
      maxWidthClassName="max-w-sm"
      className="overflow-y-auto p-6"
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
    </AppModal>
  );
}
