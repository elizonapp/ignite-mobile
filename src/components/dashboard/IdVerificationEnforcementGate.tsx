import { useEffect, useState } from "react";

import { useAuth } from "../AuthProvider";
import {
  IdVerificationEnforcementModal,
  isIdVerificationEnforcementDismissed,
  type IdVerificationEnforcementData,
} from "./IdVerificationEnforcementModal";
import { api } from "../../lib/api";

export function IdVerificationEnforcementGate() {
  const { isAuthenticated, user } = useAuth();
  const [enforcement, setEnforcement] = useState<IdVerificationEnforcementData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setEnforcement(null);
      setDismissed(false);
      return;
    }

    let cancelled = false;
    api.idVerification
      .enforcementStatus()
      .then((data) => {
        if (cancelled || !data?.success || !data.required) {
          if (!cancelled) {
            setEnforcement(null);
            setDismissed(false);
          }
          return;
        }
        const next: IdVerificationEnforcementData = {
          required: Boolean(data.required),
          deadlineAt: data.deadlineAt ?? null,
          relatedCaseReportId: data.relatedCaseReportId ?? null,
          verificationId: data.verificationId ?? null,
          canRefuse: Boolean(data.canRefuse),
        };
        setEnforcement(next);
        setDismissed(isIdVerificationEnforcementDismissed(next.verificationId));
      })
      .catch(() => {
        if (!cancelled) {
          setEnforcement(null);
          setDismissed(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  if (!enforcement?.required || dismissed) return null;

  return (
    <IdVerificationEnforcementModal
      enforcement={enforcement}
      onDismiss={() => setDismissed(true)}
      onRefused={() => {
        setEnforcement(null);
        setDismissed(false);
      }}
    />
  );
}
