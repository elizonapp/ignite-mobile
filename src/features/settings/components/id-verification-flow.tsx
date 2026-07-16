import { useCallback, useEffect, useRef, useState } from "react";

import { resolveApiError } from "../../../api/resolve-error";
import { resolveCaughtApiError } from "../../../api/resolve-caught-error";
import type { IdVerificationAddress, IdVerificationStatusResponse } from "../../../api/id-verification";
import { ENJYN_LINK_SESSION_TTL_MS } from "../../../api/id-verification";
import { useToast } from "../../../components/Toast";
import { useI18n } from "../../../i18n";
import { api } from "../../../lib/api";
import { openHostedFlow } from "../../../lib/hosted-flow";

type Address = IdVerificationAddress;
type VerificationRecord = NonNullable<IdVerificationStatusResponse["pending"]>;
type StatusResponse = IdVerificationStatusResponse;

type Step = "overview" | "precheck" | "country" | "doctype" | "upload" | "enjyn" | "pending";

type EnjynCallbackParams = {
  /** Untrusted hint from redirect URL — only used for mismatch detection, never for status. */
  sessionId?: string | null;
};

type EnjynCallbackOutcome = "verified" | "failed" | "expired" | "processing" | "pending" | "none" | null;

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getEnjynLinkRemainingMs(
  payload: VerificationRecord["enjynCallbackPayload"],
): number | null {
  if (!payload?.verifyUrl) return null;
  if (payload.enjynStatus && payload.enjynStatus !== "pending") return null;

  const createdAt = payload.enjynSessionCreatedAt
    ? new Date(payload.enjynSessionCreatedAt).getTime()
    : NaN;
  if (Number.isNaN(createdAt)) return null;

  return createdAt + ENJYN_LINK_SESSION_TTL_MS - Date.now();
}

type IdVerificationFlowProps = {
  isActive: boolean;
  enjynReturn?: boolean;
  enjynCallback?: EnjynCallbackParams;
  onCallbackHandled?: () => void;
  onOpenAddresses?: () => void;
};

function panelClass(embedded: boolean): string {
  return embedded
    ? "rounded-xl border border-(--border) bg-white/5 p-4 sm:p-5 space-y-4"
    : "glass rounded-2xl p-6 space-y-4";
}

function ExplicitConsentBlock({
  checked,
  onChange,
  t,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  t: (key: never) => string;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-white/5 p-4 space-y-3">
      <p className="text-sm text-(--text-muted)">{t("idVerificationConsentBody" as never)}</p>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border)"
        />
        <span>{t("idVerificationConsentCheckbox" as never)}</span>
      </label>
    </div>
  );
}

export function IdVerificationFlow({
  isActive,
  enjynReturn = false,
  enjynCallback,
  onCallbackHandled,
  onOpenAddresses,
}: IdVerificationFlowProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const embedded = true;

  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [step, setStep] = useState<Step>("overview");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedDocTypeId, setSelectedDocTypeId] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [currentMethod, setCurrentMethod] = useState<string | null>(null);

  const selfieRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackHandledRef = useRef(false);

  const [callbackOutcome, setCallbackOutcome] = useState<EnjynCallbackOutcome>(null);
  const [isCheckingCallback, setIsCheckingCallback] = useState(false);
  const [explicitConsentChecked, setExplicitConsentChecked] = useState(false);
  const [enjynLinkRemainingMs, setEnjynLinkRemainingMs] = useState<number | null>(null);

  const applyStatus = useCallback((json: StatusResponse) => {
    setStatus(json);
    if (json.pending?.consentGiven) {
      setExplicitConsentChecked(true);
    }
    if (json.user) {
      setFirstName(json.user.firstName || "");
      setLastName(json.user.lastName || "");
      if (json.user.dateOfBirth) {
        setDateOfBirth(json.user.dateOfBirth.slice(0, 10));
      }
    }
    if (json.pending) {
      setVerificationId(json.pending.id);
      setCurrentMethod(json.pending.method);
      const payload = json.pending.enjynCallbackPayload;
      if (payload?.countryCode) {
        setSelectedCountryCode(payload.countryCode);
      }
      if (payload?.documentTypeId) {
        setSelectedDocTypeId(payload.documentTypeId);
        if (json.pending.method === "AUTOMATED_ENJYN") {
          setStep("enjyn");
        } else if (json.pending.hasImages) {
          setStep("pending");
        } else if (json.pending.method === "MANUAL_UPLOAD") {
          setStep("upload");
        } else {
          setStep("doctype");
        }
      } else {
        setStep("country");
      }
    } else if (json.verified) {
      setStep("overview");
    } else {
      setStep("overview");
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const json = await api.idVerification.status();
      if (json.success !== false) {
        applyStatus(json);
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsLoading(false);
    }
  }, [applyStatus, show, t]);

  const processEnjynCallback = useCallback(async () => {
    setIsCheckingCallback(true);
    setIsLoading(true);
    try {
      const json = await api.idVerification.enjynCallback(enjynCallback?.sessionId ?? undefined);
      if (json.success !== false) {
        applyStatus(json);
        setCallbackOutcome(json.outcome ?? "none");
        onCallbackHandled?.();
      } else {
        setCallbackOutcome("none");
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      setCallbackOutcome("none");
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsCheckingCallback(false);
      setIsLoading(false);
    }
  }, [applyStatus, enjynCallback?.sessionId, onCallbackHandled, show, t]);

  const fetchAddresses = useCallback(async () => {
    try {
      const json = await api.settings.addresses();
      if (json.success) {
        setAddresses((json.addresses || []) as Address[]);
        const defaultAddr = (json.addresses as Address[]).find((a) => a.isDefault);
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
        else if (json.addresses?.length) {
          const first = json.addresses[0] as Address | undefined;
          if (first) setSelectedAddressId(first.id);
        }
      }
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    fetchAddresses();
  }, [isActive, fetchAddresses]);

  useEffect(() => {
    if (!isActive) {
      callbackHandledRef.current = false;
      setCallbackOutcome(null);
      setIsCheckingCallback(false);
      return;
    }
    if (enjynReturn) {
      if (!callbackHandledRef.current) {
        callbackHandledRef.current = true;
        processEnjynCallback();
      }
      return;
    }
    setIsLoading(true);
    fetchStatus();
  }, [isActive, enjynReturn, fetchStatus, processEnjynCallback]);

  useEffect(() => {
    if (!isActive || !enjynReturn) return;
    if (callbackOutcome === "processing" || callbackOutcome === "pending") {
      pollRef.current = setInterval(processEnjynCallback, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    return undefined;
  }, [isActive, enjynReturn, callbackOutcome, processEnjynCallback]);

  useEffect(() => {
    if (!isActive || enjynReturn) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return undefined;
    }
    if (step === "pending" || step === "enjyn") {
      pollRef.current = setInterval(fetchStatus, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return undefined;
  }, [isActive, enjynReturn, step, fetchStatus]);

  useEffect(() => {
    if (!isActive || step !== "enjyn" || enjynReturn) {
      setEnjynLinkRemainingMs(null);
      return undefined;
    }

    const payload = status?.pending?.enjynCallbackPayload;
    const currentEnjynStatus = payload?.enjynStatus;

    const updateRemaining = () => {
      const remaining = getEnjynLinkRemainingMs(payload);
      setEnjynLinkRemainingMs(remaining);

      if (remaining !== null && remaining <= 0 && currentEnjynStatus === "pending") {
        fetchStatus();
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [isActive, step, enjynReturn, status?.pending?.enjynCallbackPayload, fetchStatus]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const selectedCountry = (status?.verificationCountries || []).find(
    (country) => country.countryCode === selectedCountryCode,
  );
  const availableDocumentTypes = selectedCountry?.documentTypes || [];

  const handleStart = async () => {
    if (!selectedAddress) {
      show(t("idVerificationAddressRequired"), "error");
      return;
    }
    if (!explicitConsentChecked) {
      show(t("idVerificationConsentRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const json = await api.idVerification.start({
        firstName,
        lastName,
        dateOfBirth,
        addressId: selectedAddress.id,
        addressStreet: selectedAddress.street,
        addressZip: selectedAddress.zip,
        addressCity: selectedAddress.city,
        addressCountryCode: selectedAddress.countryCode || "DE",
        explicitConsent: true,
      });
      if (json.success) {
        setVerificationId(json.verification.id);
        setSelectedCountryCode("");
        setSelectedDocTypeId("");
        setStep("country");
        fetchStatus();
      } else {
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectMethod = async () => {
    if (!verificationId || !selectedDocTypeId || !selectedCountryCode) return;
    const needsConsent = !status?.pending?.consentGiven;
    if (needsConsent && !explicitConsentChecked) {
      show(t("idVerificationConsentRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const json = await api.idVerification.selectMethod(verificationId, {
        countryCode: selectedCountryCode,
        documentTypeId: selectedDocTypeId,
        ...(needsConsent ? { explicitConsent: true } : {}),
      });
      if (json.success) {
        setCurrentMethod(json.verification.method);
        if (json.verification.method === "AUTOMATED_ENJYN") {
          setStep("enjyn");
          await fetchStatus();
        } else {
          setStep("upload");
        }
      } else {
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEnjyn = async () => {
    if (!verificationId) return;
    const needsConsent = !status?.pending?.consentGiven;
    if (needsConsent && !explicitConsentChecked) {
      show(t("idVerificationConsentRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const json = await api.idVerification.enjynStart(
        verificationId,
        needsConsent ? { explicitConsent: true } : {},
      );
      if (json.success) {
        await fetchStatus();
        setStep("enjyn");
      } else {
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestartEnjyn = async () => {
    if (!verificationId) return;
    const needsConsent = !status?.pending?.consentGiven;
    if (needsConsent && !explicitConsentChecked) {
      show(t("idVerificationConsentRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const json = await api.idVerification.enjynRestart(
        verificationId,
        needsConsent ? { explicitConsent: true } : {},
      );
      if (json.success) {
        show(t("idVerificationEnjynOpenLink"), "success");
        await fetchStatus();
        setStep("enjyn");
      } else {
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingEnjyn = status?.pending?.enjynCallbackPayload;
  const enjynStatus = pendingEnjyn?.enjynStatus;
  const enjynVerifyUrl = pendingEnjyn?.verifyUrl;
  const enjynQrUrl = pendingEnjyn?.qrUrl;
  const enjynSessionStartError = pendingEnjyn?.enjynSessionStartError;
  const enjynLinkActive =
    Boolean(enjynVerifyUrl) &&
    enjynStatus !== "failed" &&
    enjynStatus !== "expired" &&
    (enjynLinkRemainingMs === null || enjynLinkRemainingMs > 0);
  const adminRequested = Boolean(status?.pending?.requestedByAdminId);
  const caseRequested = Boolean(status?.pending?.relatedCaseReportId);
  const needsExplicitConsent = Boolean(status?.pending && !status.pending.consentGiven);
  const isIdentVerified = Boolean(status?.verified || status?.user?.identVerified);

  const handleUpload = async () => {
    if (!verificationId) return;
    const needsConsent = !status?.pending?.consentGiven;
    if (needsConsent && !explicitConsentChecked) {
      show(t("idVerificationConsentRequired"), "error");
      return;
    }
    const selfie = selfieRef.current?.files?.[0];
    const front = frontRef.current?.files?.[0];
    const back = backRef.current?.files?.[0];
    if (!selfie || !front || !back) {
      show(t("idVerificationUploadAllRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("selfie", selfie);
      formData.append("front", front);
      formData.append("back", back);
      if (needsConsent) {
        formData.append("explicitConsent", "true");
      }
      const json = await api.idVerification.upload(verificationId, formData);
      if (json.success) {
        show(t("idVerificationUploadSuccess"), "success");
        setStep("pending");
        fetchStatus();
      } else {
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!verificationId || !status?.pending?.requestedByAdminId) return;
    if (!window.confirm(t("idVerificationDeclineConfirm"))) return;
    setIsSubmitting(true);
    try {
      const json = await api.idVerification.decline(verificationId);
      if (json.success) {
        show(t("idVerificationDeclined"), "success");
        fetchStatus();
        setStep("overview");
      } else {
        show(resolveApiError(json, t, { fallbackKey: "error" }), "error");
      }
    } catch (err) {
      show(resolveCaughtApiError(err, t), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isActive) return null;

  const callbackBanner = (() => {
    if (isCheckingCallback && enjynReturn) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-(--border) bg-white/5 p-4 text-sm text-(--text-muted)">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--primary) border-t-transparent" />
          {t("idVerificationEnjynCallbackChecking")}
        </div>
      );
    }
    if (!callbackOutcome || callbackOutcome === "none") return null;

    if (callbackOutcome === "verified") {
      return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {t("idVerificationEnjynCallbackSuccess")}
        </div>
      );
    }
    if (callbackOutcome === "failed") {
      return (
        <div className="rounded-xl border border-(--error)/30 bg-(--error)/10 p-4 text-sm text-(--error)">
          {t("idVerificationEnjynCallbackFailed")}
        </div>
      );
    }
    if (callbackOutcome === "expired") {
      return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {t("idVerificationEnjynCallbackExpired")}
        </div>
      );
    }
    if (callbackOutcome === "processing") {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-(--border) bg-white/5 p-4 text-sm text-(--text-muted)">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--primary) border-t-transparent" />
          {t("idVerificationEnjynCallbackProcessing")}
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-(--border) bg-white/5 p-4 text-sm text-(--text-muted)">
        {t("idVerificationEnjynCallbackPending")}
      </div>
    );
  })();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse rounded-xl bg-white/5 h-24" />
        <div className="animate-pulse rounded-xl bg-white/5 h-40" />
      </div>
    );
  }

  const panel = panelClass(embedded);

  return (
    <div className="space-y-4">
      {callbackBanner}

      {status?.pending?.requestedByAdminId && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200">
            {caseRequested
              ? t("idVerificationCaseRequestedBanner")
              : t("idVerificationAdminRequestedBanner")}
          </p>
          <button
            type="button"
            onClick={handleDecline}
            disabled={isSubmitting}
            className="btn-secondary mt-3 text-sm"
          >
            {t("idVerificationDeclineLink")}
          </button>
        </div>
      )}

      {isIdentVerified && status?.verified && (
        <div className={panel}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium">{t("idVerificationVerifiedTitle")}</h2>
              <p className="text-sm text-(--text-muted)">{t("idVerificationVerifiedDesc")}</p>
            </div>
          </div>
          <div className="border-t border-(--border) pt-4 space-y-2 text-sm">
            <p>
              <span className="text-(--text-muted)">{t("idVerificationSnapshotName")}: </span>
              {status.verified.verificationFirstName} {status.verified.verificationLastName}
            </p>
            <p>
              <span className="text-(--text-muted)">{t("idVerificationSnapshotAddress")}: </span>
              {status.verified.addressStreet}, {status.verified.addressZip} {status.verified.addressCity},{" "}
              {status.verified.addressCountryCode}
            </p>
          </div>
        </div>
      )}

      {!isIdentVerified && step === "overview" && !status?.pending && (
        <div className={panel}>
          <p className="text-sm text-(--text-muted) mb-4">{t("idVerificationOverviewDesc")}</p>
          <button type="button" onClick={() => setStep("precheck")} className="btn-primary">
            {t("idVerificationStartButton")}
          </button>
        </div>
      )}

      {step === "precheck" && (
        <div className={panel}>
          <h2 className="text-lg font-medium">{t("idVerificationPrecheckTitle")}</h2>
          <p className="text-sm text-(--text-muted)">{t("idVerificationPrecheckDesc")}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-(--text-muted) mb-1.5">{t("addressFirstName")} *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-(--border) bg-white/5 px-4 py-2.5 text-sm focus:border-(--primary) focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-(--text-muted) mb-1.5">{t("addressLastName")} *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-(--border) bg-white/5 px-4 py-2.5 text-sm focus:border-(--primary) focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-(--text-muted) mb-1.5">{t("idVerificationDateOfBirth")} *</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={!status?.dobCorrectionAvailable && Boolean(status?.user?.dobCorrectionUsedAt)}
              className="w-full rounded-xl border border-(--border) bg-white/5 px-4 py-2.5 text-sm focus:border-(--primary) focus:outline-none disabled:opacity-60"
            />
            {!status?.dobCorrectionAvailable && (
              <p className="mt-1 text-xs text-(--text-muted)">{t("idVerificationDobLocked")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-(--text-muted) mb-1.5">{t("idVerificationAddressSelect")} *</label>
            {addresses.length === 0 ? (
              <p className="text-sm text-(--text-muted)">
                {t("idVerificationNoAddresses")}{" "}
                <button
                  type="button"
                  onClick={onOpenAddresses}
                  className="text-(--primary) underline"
                >
                  {t("idVerificationManageAddresses")}
                </button>
              </p>
            ) : (
              <select
                value={selectedAddressId}
                onChange={(e) => setSelectedAddressId(e.target.value)}
                className="w-full rounded-xl border border-(--border) bg-white/5 px-4 py-2.5 text-sm focus:border-(--primary) focus:outline-none"
              >
                {addresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label || addr.street} — {addr.street}, {addr.zip} {addr.city}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="text-xs text-(--text-muted)">* {t("requiredFieldLegend")}</p>

          <ExplicitConsentBlock
            checked={explicitConsentChecked}
            onChange={setExplicitConsentChecked}
            t={t}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => setStep("overview")} className="btn-secondary">
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={
                isSubmitting ||
                !firstName ||
                !lastName ||
                !dateOfBirth ||
                !selectedAddressId ||
                !explicitConsentChecked
              }
              className="btn-primary disabled:opacity-50"
            >
              {isSubmitting ? t("loading") : t("idVerificationContinueButton")}
            </button>
          </div>
        </div>
      )}

      {step === "country" && (
        <div className={panel}>
          <h2 className="text-lg font-medium">{t("idVerificationCountryTitle")}</h2>
          <p className="text-sm text-(--text-muted)">{t("idVerificationCountryDesc")}</p>
          <div className="space-y-2">
            {(status?.verificationCountries || []).map((country) => (
              <label
                key={country.countryCode}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                  selectedCountryCode === country.countryCode
                    ? "border-(--primary) bg-(--primary)/10"
                    : "border-(--border) hover:bg-white/5"
                }`}
              >
                <input
                  type="radio"
                  name="verificationCountry"
                  value={country.countryCode}
                  checked={selectedCountryCode === country.countryCode}
                  onChange={() => {
                    setSelectedCountryCode(country.countryCode);
                    setSelectedDocTypeId("");
                  }}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">{country.label}</span>
              </label>
            ))}
          </div>
          {selectedCountry && (
            <p className="text-sm text-(--text-muted)">
              {t("idVerificationDocumentReady").replace("{country}", selectedCountry.label)}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => setStep("precheck")} className="btn-secondary">
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => setStep("doctype")}
              disabled={!selectedCountryCode}
              className="btn-primary disabled:opacity-50"
            >
              {t("idVerificationContinueButton")}
            </button>
          </div>
        </div>
      )}

      {step === "doctype" && (
        <div className={panel}>
          <h2 className="text-lg font-medium">{t("idVerificationDocTypeTitle")}</h2>
          <p className="text-sm text-(--text-muted)">
            {selectedCountry
              ? t("idVerificationDocTypeDescForCountry").replace("{country}", selectedCountry.label)
              : t("idVerificationDocTypeDesc")}
          </p>
          <div className="space-y-2">
            {availableDocumentTypes.map((doc) => (
              <label
                key={doc.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                  selectedDocTypeId === doc.id
                    ? "border-(--primary) bg-(--primary)/10"
                    : "border-(--border) hover:bg-white/5"
                }`}
              >
                <input
                  type="radio"
                  name="docType"
                  value={doc.id}
                  checked={selectedDocTypeId === doc.id}
                  onChange={() => setSelectedDocTypeId(doc.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">{doc.label}</span>
              </label>
            ))}
          </div>
          {needsExplicitConsent && (
            <ExplicitConsentBlock
              checked={explicitConsentChecked}
              onChange={setExplicitConsentChecked}
              t={t}
            />
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => setStep("country")} className="btn-secondary">
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSelectMethod}
              disabled={
                isSubmitting ||
                !selectedDocTypeId ||
                (needsExplicitConsent && !explicitConsentChecked)
              }
              className="btn-primary disabled:opacity-50"
            >
              {isSubmitting ? t("loading") : t("idVerificationContinueButton")}
            </button>
          </div>
        </div>
      )}

      {step === "enjyn" && (
        <div className={panel}>
          <h2 className="text-lg font-medium">{t("idVerificationEnjynTitle")}</h2>
          <p className="text-sm text-(--text-muted)">{t("idVerificationEnjynDesc")}</p>

          {needsExplicitConsent && (
            <ExplicitConsentBlock
              checked={explicitConsentChecked}
              onChange={setExplicitConsentChecked}
              t={t}
            />
          )}

          {!enjynVerifyUrl ? (
            enjynSessionStartError ? (
              <div className="space-y-4">
                <p className="text-sm text-(--error)">{enjynSessionStartError}</p>
                <button
                  type="button"
                  onClick={handleStartEnjyn}
                  disabled={isSubmitting || (needsExplicitConsent && !explicitConsentChecked)}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("idVerificationEnjynOpenLink")}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-(--text-muted)">{t("idVerificationEnjynPrepare")}</p>
                <button
                  type="button"
                  onClick={handleStartEnjyn}
                  disabled={isSubmitting || (needsExplicitConsent && !explicitConsentChecked)}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSubmitting ? t("loading") : t("idVerificationEnjynOpenLink")}
                </button>
              </div>
            )
          ) : enjynStatus === "failed" ? (
            <div className="space-y-4">
              <p className="text-sm text-(--error)">{t("idVerificationEnjynFailed")}</p>
              <button
                type="button"
                onClick={handleRestartEnjyn}
                disabled={isSubmitting || (needsExplicitConsent && !explicitConsentChecked)}
                className="btn-primary disabled:opacity-50"
              >
                {isSubmitting ? t("loading") : t("idVerificationEnjynRestart")}
              </button>
            </div>
          ) : enjynStatus === "expired" || !enjynLinkActive ? (
            <div className="space-y-4">
              <p className="text-sm text-(--error)">{t("idVerificationEnjynExpired")}</p>
              <button
                type="button"
                onClick={handleRestartEnjyn}
                disabled={isSubmitting || (needsExplicitConsent && !explicitConsentChecked)}
                className="btn-primary disabled:opacity-50"
              >
                {isSubmitting ? t("loading") : t("idVerificationEnjynRestart")}
              </button>
            </div>
          ) : (
            <>
              {enjynLinkRemainingMs !== null && enjynLinkRemainingMs > 0 && (
                <p className="text-sm text-amber-200">
                  {t("idVerificationEnjynLinkExpiresIn").replace(
                    "{time}",
                    formatCountdown(enjynLinkRemainingMs),
                  )}
                </p>
              )}

              <button
                type="button"
                onClick={() => openHostedFlow(enjynVerifyUrl, { title: t("idVerificationEnjynTitle") })}
                className="btn-primary inline-flex"
              >
                {t("idVerificationEnjynOpenVerifyLink")}
              </button>

              {enjynQrUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-(--text-muted)">{t("idVerificationEnjynQrHint")}</p>
                  <div className="inline-block rounded-xl border border-(--border) bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={enjynQrUrl} alt="" width={200} height={200} className="h-[200px] w-[200px]" />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-(--border) bg-white/5 p-4 text-sm text-(--text-muted)">
                {enjynStatus === "processing"
                  ? t("idVerificationEnjynProcessing")
                  : t("idVerificationEnjynPending")}
              </div>
            </>
          )}
        </div>
      )}

      {step === "upload" && currentMethod === "MANUAL_UPLOAD" && (
        <div className={panel}>
          <h2 className="text-lg font-medium">{t("idVerificationUploadTitle")}</h2>
          <p className="text-sm text-(--text-muted)">{t("idVerificationUploadDesc")}</p>

          {(["selfie", "front", "back"] as const).map((kind) => (
            <div key={kind}>
              <label className="block text-sm text-(--text-muted) mb-1.5">
                {kind === "selfie"
                  ? t("idVerificationUploadSelfie")
                  : kind === "front"
                    ? t("idVerificationUploadFront")
                    : t("idVerificationUploadBack")}{" "}
                *
              </label>
              <input
                ref={kind === "selfie" ? selfieRef : kind === "front" ? frontRef : backRef}
                type="file"
                accept="image/png,image/jpeg"
                capture="environment"
                className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-(--primary)/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-(--primary)"
              />
            </div>
          ))}

          {needsExplicitConsent && (
            <ExplicitConsentBlock
              checked={explicitConsentChecked}
              onChange={setExplicitConsentChecked}
              t={t}
            />
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={isSubmitting || (needsExplicitConsent && !explicitConsentChecked)}
            className="btn-primary disabled:opacity-50"
          >
            {isSubmitting ? t("loading") : t("idVerificationSubmitUpload")}
          </button>
        </div>
      )}

      {step === "pending" && (
        <div className={panel}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--primary) border-t-transparent" />
            <h2 className="text-lg font-medium">{t("idVerificationPendingTitle")}</h2>
          </div>
          <p className="text-sm text-(--text-muted)">{t("idVerificationPendingDesc")}</p>
        </div>
      )}
    </div>
  );
}
