import { IdVerificationFlow } from "../components/id-verification-flow";
import { SettingsSubView } from "../components";
import { useI18n } from "../../../i18n";

type IdVerificationSettingsViewProps = {
  onBack: () => void;
  onOpenAddresses: () => void;
  enjynReturn?: boolean;
  enjynSessionId?: string | null;
  onEnjynCallbackHandled?: () => void;
};

export function IdVerificationSettingsView({
  onBack,
  onOpenAddresses,
  enjynReturn = false,
  enjynSessionId,
  onEnjynCallbackHandled,
}: IdVerificationSettingsViewProps) {
  const { t } = useI18n();

  return (
    <SettingsSubView title={t("idVerificationTitle")} onBack={onBack}>
      <p className="text-sm text-(--text-muted)">{t("idVerificationSubtitle")}</p>
      <IdVerificationFlow
        isActive
        enjynReturn={enjynReturn}
        enjynCallback={enjynSessionId ? { sessionId: enjynSessionId } : undefined}
        onCallbackHandled={onEnjynCallbackHandled}
        onOpenAddresses={onOpenAddresses}
      />
    </SettingsSubView>
  );
}
