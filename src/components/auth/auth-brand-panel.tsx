import { BrandLogo } from "../BrandLogo";
import { useI18n } from "../../i18n";

const FEATURES = [
  {
    key: "authLoginBrandFeatureServers" as const,
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M5 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2" />
      </svg>
    ),
  },
  {
    key: "authLoginBrandFeatureSecurity" as const,
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    key: "authLoginBrandFeatureTeam" as const,
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
] as const;

type AuthBrandPanelProps = {
  compact?: boolean;
  variant?: "login" | "register";
};

export function AuthBrandPanel({ compact = false, variant = "login" }: AuthBrandPanelProps) {
  const { t } = useI18n();

  const headlineKey = variant === "register" ? "authRegisterBrandHeadline" : "authLoginBrandHeadline";
  const sublineKey = variant === "register" ? "authRegisterBrandSubline" : "authLoginBrandSubline";

  if (compact) {
    return (
      <div className="flex flex-col items-center text-center">
        <BrandLogo width={96} height={72} />
        <p className="mt-3 text-sm text-(--text-secondary)">{t(sublineKey)}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-full flex-col justify-between p-8 xl:p-10">
      <div>
        <BrandLogo width={128} height={96} />
        <h2 className="mt-8 text-2xl font-semibold leading-snug text-(--text-primary) xl:text-3xl">
          {t(headlineKey)}
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-(--text-secondary)">{t(sublineKey)}</p>
      </div>

      <ul className="mt-10 space-y-4">
        {FEATURES.map(({ key, icon }) => (
          <li key={key} className="flex items-start gap-3 text-sm text-(--text-secondary)">
            <span className="mt-0.5 text-(--primary)">{icon}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
