import { Loader2 } from "lucide-react";

import { AuthLegalConsent } from "../components/auth/auth-legal-consent";
import { AuthField } from "../components/auth/auth-field";
import { authInputBaseClass, authInputErrorClass, authInputOkClass } from "../components/auth/auth-styles";
import { AuthShell } from "../components/auth/auth-shell";
import { RegisterProgress } from "../components/auth/register-progress";
import { RegisterStepNav } from "../components/auth/register-step-nav";
import { useRegister } from "../features/auth/use-register";

type RegisterScreenProps = {
  onLogin: () => void;
};

export function RegisterScreen({ onLogin }: RegisterScreenProps) {
  const vm = useRegister(onLogin);

  if (vm.statusLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-(--primary)" />
      </div>
    );
  }

  if (vm.registrationStatus && !vm.registrationStatus.allowRegistration) {
    return (
      <AuthShell variant="register">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-(--text-primary)">{vm.t("authRegistrationDisabledGeneral")}</h1>
          <button type="button" onClick={onLogin} className="btn-primary mt-6 px-6 py-3 text-sm font-semibold">
            {vm.t("authBackToLogin")}
          </button>
        </div>
      </AuthShell>
    );
  }

  if (vm.success) {
    return (
      <AuthShell variant="register">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-(--primary)/20">
            <svg className="h-8 w-8 text-(--primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">{vm.t("authEmailSent")}</h1>
          <p className="mt-2 text-sm text-(--text-secondary)">{vm.t("authEmailSentDesc")}</p>
          {vm.devActivationCode && (
            <div className="mt-6 rounded-control border border-amber-500/50 bg-amber-500/10 p-4 text-left">
              <p className="text-sm text-(--text-secondary)">{vm.t("authMailNotConfigured")}</p>
              <p className="mt-2 font-mono text-xl font-bold tracking-widest text-(--text-primary)">{vm.devActivationCode}</p>
            </div>
          )}
          <button type="button" onClick={onLogin} className="mt-8 text-sm text-(--primary) hover:underline">
            {vm.t("authBackToLogin")}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell variant="register">
      {vm.step === 0 && <AccountTypeStep vm={vm} onLogin={onLogin} />}
      {vm.step === 1 && <AddressStep vm={vm} />}
      {vm.step === 2 && <AccountDetailsStep vm={vm} />}
    </AuthShell>
  );
}

type Vm = ReturnType<typeof useRegister>;

function AccountTypeStep({ vm, onLogin }: { vm: Vm; onLogin: () => void }) {
  return (
    <>
      <RegisterProgress step={0} />
      <div className="mb-8">
        <p className="mb-2 text-xs text-(--text-muted)">{vm.t("authRegisterStep1")}</p>
        <h1 className="text-2xl font-semibold text-(--text-primary)">{vm.t("authAccountTypeTitle")}</h1>
        <p className="mt-2 text-sm text-(--text-secondary)">{vm.t("authAccountTypeSubtitle")}</p>
      </div>

      <div className="grid gap-3">
        <div>
          <button
            type="button"
            onClick={() => vm.handleAccountTypeSelect("private")}
            disabled={vm.registrationStatus !== null && !vm.registrationStatus.allowRegistrationPrivate}
            className="flex w-full cursor-pointer flex-col items-start rounded-control border border-(--border) bg-(--bg-elevated) p-5 text-left transition-colors hover:border-(--primary)/40 hover:bg-(--primary)/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-lg font-semibold text-(--text-primary)">{vm.t("authAccountTypePrivate")}</span>
            <span className="mt-1 text-sm text-(--text-secondary)">{vm.t("authAccountTypePrivateDesc")}</span>
          </button>
          {vm.registrationStatus && !vm.registrationStatus.allowRegistrationPrivate && (
            <p className="mt-2 text-sm text-amber-400">{vm.t("authRegistrationDisabledPrivate")}</p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => vm.handleAccountTypeSelect("business")}
            disabled={vm.registrationStatus !== null && !vm.registrationStatus.allowRegistrationBusiness}
            className="flex w-full cursor-pointer flex-col items-start rounded-control border border-(--border) bg-(--bg-elevated) p-5 text-left transition-colors hover:border-(--primary)/40 hover:bg-(--primary)/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-lg font-semibold text-(--text-primary)">{vm.t("authAccountTypeBusiness")}</span>
            <span className="mt-1 text-sm text-(--text-secondary)">{vm.t("authAccountTypeBusinessDesc")}</span>
          </button>
          {vm.registrationStatus && !vm.registrationStatus.allowRegistrationBusiness && (
            <p className="mt-2 text-sm text-amber-400">{vm.t("authRegistrationDisabledBusiness")}</p>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <button type="button" onClick={onLogin} className="text-sm text-(--text-secondary) transition-colors hover:text-(--primary)">
          {vm.t("authHaveAccount")}{" "}
          <span className="font-medium text-(--primary)">{vm.t("authLogin")}</span>
        </button>
      </div>
    </>
  );
}

function AddressStep({ vm }: { vm: Vm }) {
  const selectClass = (field: string) =>
    `${authInputBaseClass} ${vm.fieldErrors[field] ? authInputErrorClass : authInputOkClass}`;

  return (
    <>
      <RegisterProgress step={1} />
      <div className="mb-6">
        <p className="mb-2 text-xs text-(--text-muted)">{vm.t("authRegisterStep2")}</p>
        <h1 className="text-2xl font-semibold text-(--text-primary)">{vm.t("authAddressRequired")}</h1>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          vm.handleNextStep();
        }}
        className="space-y-4"
      >
        {vm.accountType === "business" && (
          <>
            <AuthField
              id="companyName"
              label={`${vm.t("authCompanyName")} *`}
              type="text"
              value={vm.companyName}
              onChange={(e) => {
                vm.setCompanyName(e.target.value);
                vm.clearFieldError("companyName");
              }}
              error={vm.fieldErrors.companyName}
              required
            />
            <AuthField
              id="vatNumber"
              label={vm.t("authVatNumber")}
              type="text"
              value={vm.vatNumber}
              onChange={(e) => vm.setVatNumber(e.target.value)}
              placeholder="DE123456789"
              autoComplete="off"
            />
          </>
        )}

        <AuthField id="country" label={`${vm.t("authCountry")} *`} error={vm.fieldErrors.country}>
          <select
            id="country"
            value={vm.country}
            onChange={(e) => {
              vm.setCountry(e.target.value);
              vm.clearFieldError("country");
            }}
            className={selectClass("country")}
            required
            disabled={vm.loadingCountries}
          >
            <option value="">{vm.t("authSelectCountry")}</option>
            {vm.countries.map((c) => (
              <option key={c.countryCode} value={c.countryCode}>
                {c.countryName}
              </option>
            ))}
          </select>
        </AuthField>

        <AuthField
          id="street"
          label={`${vm.t("authStreet")} *`}
          type="text"
          value={vm.street}
          onChange={(e) => {
            vm.setStreet(e.target.value);
            vm.clearFieldError("street");
          }}
          error={vm.fieldErrors.street}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <AuthField
            id="zip"
            label={`${vm.t("authZip")} *`}
            type="text"
            value={vm.zip}
            onChange={(e) => {
              vm.setZip(e.target.value);
              vm.clearFieldError("zip");
            }}
            error={vm.fieldErrors.zip}
            required
          />
          <AuthField
            id="city"
            label={`${vm.t("authCity")} *`}
            type="text"
            value={vm.city}
            onChange={(e) => {
              vm.setCity(e.target.value);
              vm.clearFieldError("city");
            }}
            error={vm.fieldErrors.city}
            required
          />
        </div>

        <RegisterStepNav onBack={vm.handlePrevStep} backLabel={vm.t("prevStep")} submitLabel={vm.t("nextStep")} />
      </form>
    </>
  );
}

function AccountDetailsStep({ vm }: { vm: Vm }) {
  const selectClass = `${authInputBaseClass} ${authInputOkClass}`;

  return (
    <>
      <RegisterProgress step={2} />
      <div className="mb-6">
        <p className="mb-2 text-xs text-(--text-muted)">{vm.t("authRegisterStep3")}</p>
        <h1 className="text-2xl font-semibold text-(--text-primary)">{vm.t("authRegisterTitle")}</h1>
        <p className="mt-2 text-sm text-(--text-secondary)">{vm.t("authRegisterSubtitle")}</p>
      </div>

      <form noValidate onSubmit={vm.handleSubmit} className="space-y-4">
        <AuthField id="locale" label={vm.t("authLanguage")}>
          <select
            id="locale"
            value={vm.locale}
            onChange={(e) => vm.setLocale(e.target.value as "de" | "en")}
            className={selectClass}
          >
            <option value="de">{vm.t("authLanguageDe")}</option>
            <option value="en">{vm.t("authLanguageEn")}</option>
          </select>
        </AuthField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AuthField
            id="firstName"
            label={`${vm.t("addressFirstName")} *`}
            type="text"
            value={vm.firstName}
            onChange={(e) => vm.setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
          <AuthField
            id="lastName"
            label={`${vm.t("addressLastName")} *`}
            type="text"
            value={vm.lastName}
            onChange={(e) => vm.setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>

        <p className="text-xs text-(--text-muted)">{vm.t("authNameHint")}</p>

        <AuthField
          id="email"
          label={`${vm.t("authEmail")} *`}
          type="email"
          value={vm.email}
          onChange={(e) => {
            vm.setEmail(e.target.value);
            vm.clearFieldError("email");
          }}
          error={vm.fieldErrors.email}
          autoComplete="email"
          required
        />

        <AuthField
          id="password"
          label={`${vm.t("authPassword")} *`}
          type="password"
          value={vm.password}
          onChange={(e) => {
            vm.setPassword(e.target.value);
            vm.clearFieldError("password");
          }}
          error={vm.fieldErrors.password}
          autoComplete="new-password"
          required
        />

        <AuthField
          id="confirmPassword"
          label={`${vm.t("authConfirmPassword")} *`}
          type="password"
          value={vm.confirmPassword}
          onChange={(e) => {
            vm.setConfirmPassword(e.target.value);
            vm.clearFieldError("confirmPassword");
          }}
          error={vm.fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-control border border-(--border) bg-(--bg-elevated) p-4">
          <input
            type="checkbox"
            checked={vm.newsletterOptIn}
            onChange={(e) => vm.setNewsletterOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-(--border) text-(--primary) focus:ring-(--primary)"
          />
          <span>
            <span className="block text-sm font-medium text-(--text-primary)">{vm.t("authNewsletterOptIn")}</span>
            <span className="mt-1 block text-xs text-(--text-muted)">{vm.t("authNewsletterOptInDesc")}</span>
          </span>
        </label>

        <AuthLegalConsent
          acceptTerms={vm.acceptTerms}
          acceptPrivacy={vm.acceptPrivacy}
          onAcceptTermsChange={vm.setAcceptTerms}
          onAcceptPrivacyChange={vm.setAcceptPrivacy}
          error={vm.fieldErrors.legal}
        />

        <RegisterStepNav
          onBack={vm.handlePrevStep}
          backLabel={vm.t("prevStep")}
          submitLabel={vm.t("authRegister")}
          submitLoading={vm.isSubmitting}
        />
      </form>
    </>
  );
}
