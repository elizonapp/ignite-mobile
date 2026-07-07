import { useI18n } from "../../i18n";
import { useAuthLegal } from "./auth-legal-context";

type AuthLegalConsentProps = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  onAcceptTermsChange: (value: boolean) => void;
  onAcceptPrivacyChange: (value: boolean) => void;
  error?: string | null;
};

export function AuthLegalConsent({
  acceptTerms,
  acceptPrivacy,
  onAcceptTermsChange,
  onAcceptPrivacyChange,
  error,
}: AuthLegalConsentProps) {
  const { t } = useI18n();
  const { openLegal } = useAuthLegal();

  return (
    <div className="space-y-3 border-t border-(--border) pt-4">
      {error && <p className="text-sm text-(--error)">{error}</p>}

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => onAcceptTermsChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border) text-(--primary) focus:ring-(--primary)"
        />
        <span className="text-sm text-(--text-secondary)">
          {t("acceptTos")}{" "}
          <button
            type="button"
            onClick={() => openLegal("terms")}
            className="cursor-pointer text-(--primary) underline hover:no-underline"
          >
            {t("termsOfService")}
          </button>{" "}
          {t("andThe")}{" "}
          <button
            type="button"
            onClick={() => openLegal("privacy")}
            className="cursor-pointer text-(--primary) underline hover:no-underline"
          >
            {t("privacyPolicy")}
          </button>
          .
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={acceptPrivacy}
          onChange={(e) => onAcceptPrivacyChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border) text-(--primary) focus:ring-(--primary)"
        />
        <span className="text-sm text-(--text-secondary)">{t("authAcceptPrivacyConfirm")}</span>
      </label>
    </div>
  );
}
