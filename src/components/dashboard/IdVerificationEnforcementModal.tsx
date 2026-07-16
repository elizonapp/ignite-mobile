import { useState } from "react";

import { ConfirmModal } from "../ui/ConfirmModal";
import { useRouter } from "../Router";
import { useToast } from "../Toast";
import { useI18n } from "../../i18n";
import { resolveApiError } from "../../api/resolve-error";
import type { IdVerificationEnforcementStatus } from "../../api/id-verification";
import { api } from "../../lib/api";

const DISMISS_STORAGE_KEY = "elizon_id_verification_enforcement_dismissed";

export type IdVerificationEnforcementData = Pick<
  IdVerificationEnforcementStatus,
  "required" | "deadlineAt" | "relatedCaseReportId" | "verificationId" | "canRefuse"
>;

function formatDeadline(iso: string | null, locale: "de" | "en"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString(locale === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function isIdVerificationEnforcementDismissed(verificationId: string | null): boolean {
  if (typeof window === "undefined" || !verificationId) return false;
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { verificationId?: string };
    return parsed.verificationId === verificationId;
  } catch {
    return false;
  }
}

export function dismissIdVerificationEnforcement(verificationId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify({ verificationId }));
}

type IdVerificationEnforcementModalProps = {
  enforcement: IdVerificationEnforcementData;
  onDismiss: () => void;
  onRefused: () => void;
};

export function IdVerificationEnforcementModal({
  enforcement,
  onDismiss,
  onRefused,
}: IdVerificationEnforcementModalProps) {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { navigate } = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refusing, setRefusing] = useState(false);

  const deadlineLabel = formatDeadline(enforcement.deadlineAt, lang);

  const handleLater = () => {
    if (enforcement.verificationId) {
      dismissIdVerificationEnforcement(enforcement.verificationId);
    }
    onDismiss();
  };

  const handleRefuse = async () => {
    if (!enforcement.verificationId) return;
    setRefusing(true);
    try {
      const data = await api.idVerification.refuseEnforcement(enforcement.verificationId);
      if (!data.success) {
        show(resolveApiError(data, t, { fallbackKey: "unknownError" }), "error");
        return;
      }
      show(t("idVerificationEnforcementRefused"), "success");
      setConfirmOpen(false);
      onRefused();
    } catch {
      show(t("unknownError"), "error");
    } finally {
      setRefusing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl sm:p-8">
          <h2 className="text-xl font-bold text-(--text-primary)">{t("idVerificationEnforcementTitle")}</h2>
          <p className="mt-2 text-sm text-(--text-muted)">
            {enforcement.relatedCaseReportId
              ? t("idVerificationEnforcementCaseDesc")
              : t("idVerificationEnforcementAdminDesc")}
          </p>
          <p className="mt-4 text-sm text-(--text-primary)">
            {t("idVerificationEnforcementDeadline").replace("{date}", deadlineLabel)}
          </p>
          <p className="mt-2 text-sm text-(--text-muted)">{t("idVerificationEnforcementFlowHint")}</p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate({ name: "settings", view: "id-verification" })}
              className="btn-primary w-full"
            >
              {t("idVerificationEnforcementVerifyNow")}
            </button>
            <button type="button" onClick={handleLater} className="btn-secondary w-full">
              {t("idVerificationEnforcementLater")}
            </button>
            {enforcement.canRefuse ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded-xl border border-(--error)/30 px-4 py-2.5 text-sm text-(--error) hover:bg-(--error)/10"
              >
                {t("idVerificationEnforcementRefuse")}
              </button>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-(--text-muted)">
            {t("idVerificationEnforcementLaterWarning").replace("{date}", deadlineLabel)}
          </p>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t("idVerificationEnforcementRefuseConfirmTitle")}
        description={t("idVerificationEnforcementRefuseConfirmDesc")}
        confirmLabel={t("idVerificationEnforcementRefuseConfirmAction")}
        cancelLabel={t("idVerificationEnforcementRefuseConfirmCancel")}
        onConfirm={() => void handleRefuse()}
        onCancel={() => setConfirmOpen(false)}
        isLoading={refusing}
        destructive
      />
    </>
  );
}
