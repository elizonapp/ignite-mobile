import { useCallback, useEffect, useState } from "react";

import { resolveApiError } from "../../api/resolve-error";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";
import { useAuth } from "../../components/AuthProvider";

export type AccountType = "private" | "business" | null;

export type Country = {
  countryCode: string;
  countryName: string;
  taxRate: number;
  taxName: string;
  isDefault: boolean;
};

export type RegistrationStatus = {
  allowRegistration: boolean;
  allowRegistrationPrivate: boolean;
  allowRegistrationBusiness: boolean;
};

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: "de" | "en";
  vatNumber?: string;
  accountType: "PRIVATE" | "BUSINESS";
  country: string;
  street: string;
  city: string;
  zip: string;
  companyName?: string;
  newsletterOptIn: boolean;
};

export function useRegister(onSuccess: () => void) {
  const { t, lang } = useI18n();
  const { register: registerUser } = useAuth();

  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  const [country, setCountry] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [locale, setLocale] = useState<"de" | "en">(lang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [devActivationCode, setDevActivationCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  useEffect(() => {
    setLocale(lang);
  }, [lang]);

  useEffect(() => {
    api.publicApi
      .registrationStatus()
      .then((data) => {
        if (data.success) {
          setRegistrationStatus({
            allowRegistration: data.allowRegistration !== false,
            allowRegistrationPrivate: data.allowRegistrationPrivate !== false,
            allowRegistrationBusiness: data.allowRegistrationBusiness !== false,
          });
        } else {
          setRegistrationStatus({
            allowRegistration: true,
            allowRegistrationPrivate: true,
            allowRegistrationBusiness: true,
          });
        }
      })
      .catch(() =>
        setRegistrationStatus({
          allowRegistration: true,
          allowRegistrationPrivate: true,
          allowRegistrationBusiness: true,
        }),
      )
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    setLoadingCountries(true);
    api.publicApi
      .countries()
      .then((data) => {
        if (data.success && data.countries) {
          setCountries(data.countries);
          const defaultCountry = data.countries.find((c) => c.isDefault);
          if (defaultCountry) setCountry(defaultCountry.countryCode);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCountries(false));
  }, []);

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return t("authWeakPassword");
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) {
      return t("authPasswordRequirements");
    }
    return null;
  };

  const handleAccountTypeSelect = (type: "private" | "business") => {
    const status = registrationStatus;
    if (type === "private" && status && !status.allowRegistrationPrivate) return;
    if (type === "business" && status && !status.allowRegistrationBusiness) return;
    setAccountType(type);
    setStep(1);
  };

  const handleNextStep = () => {
    setFieldErrors({});

    if (step === 1) {
      const err: Record<string, string> = {};
      if (!country) err.country = t("authFieldRequired");
      if (!street) err.street = t("authFieldRequired");
      if (!zip) err.zip = t("authFieldRequired");
      if (!city) err.city = t("authFieldRequired");
      if (accountType === "business" && !companyName.trim()) err.companyName = t("authFieldRequired");
      if (Object.keys(err).length > 0) {
        setFieldErrors(err);
        return;
      }
    }

    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setFieldErrors({});
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const err: Record<string, string> = {};
    if (!acceptTerms || !acceptPrivacy) err.legal = t("mustAcceptTerms");
    if (password !== confirmPassword) err.confirmPassword = t("authPasswordMismatch");
    const pwError = validatePassword(password);
    if (pwError) err.password = pwError;
    if (Object.keys(err).length > 0) {
      setFieldErrors(err);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerUser({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        locale,
        vatNumber: vatNumber.trim() || undefined,
        accountType: accountType === "business" ? "BUSINESS" : "PRIVATE",
        country,
        street,
        city,
        zip,
        companyName: companyName || undefined,
        newsletterOptIn,
      });

      if (result.success) {
        if (result.requiresVerification) {
          setSuccess(true);
          if (result.devActivationCode) setDevActivationCode(result.devActivationCode);
        } else {
          onSuccess();
        }
      } else {
        const errMap: Record<string, string> = {
          registrationDisabledGeneral: t("authRegistrationDisabledGeneral"),
          registrationDisabledPrivate: t("authRegistrationDisabledPrivate"),
          registrationDisabledBusiness: t("authRegistrationDisabledBusiness"),
          nameAddressAutomatedCheckDeclined: t("authAutomatedCheckDeclined"),
        };
        const msg =
          result.error && errMap[result.error]
            ? errMap[result.error]
            : resolveApiError(result, t, { fallbackKey: "authRegisterError" });
        setFieldErrors({ email: msg });
      }
    } catch {
      setFieldErrors({ email: t("authRegisterError") });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    statusLoading,
    step,
    accountType,
    countries,
    loadingCountries,
    country,
    setCountry,
    street,
    setStreet,
    city,
    setCity,
    zip,
    setZip,
    companyName,
    setCompanyName,
    locale,
    setLocale,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    vatNumber,
    setVatNumber,
    newsletterOptIn,
    setNewsletterOptIn,
    acceptTerms,
    setAcceptTerms,
    acceptPrivacy,
    setAcceptPrivacy,
    registrationStatus,
    fieldErrors,
    clearFieldError,
    success,
    devActivationCode,
    isSubmitting,
    handleAccountTypeSelect,
    handleNextStep,
    handlePrevStep,
    handleSubmit,
  };
}
