import { useI18n } from "../i18n";

export function CustomerFeatureUnavailable() {
  const { t } = useI18n();
  return (
    <div className="glass mx-auto mt-8 w-full max-w-screen p-8 text-center lg:max-w-6xl">
      <h2 className="text-lg font-semibold text-(--text-primary)">{t("customerFeatureUnavailableTitle")}</h2>
      <p className="mt-2 text-sm text-(--text-muted)">{t("customerFeatureUnavailableBody")}</p>
    </div>
  );
}
