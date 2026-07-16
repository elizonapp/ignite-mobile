import { useEffect, useState } from "react";

import { useRouter } from "../Router";
import { useI18n } from "../../i18n";
import { api } from "../../lib/api";
import { IconWarning } from "./dashboard-icons";

export function ContractOverduePaymentBanner() {
  const { t } = useI18n();
  const { navigate } = useRouter();
  const [hasOverdue, setHasOverdue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.dashboard
      .contractPaymentAlert()
      .then((data) => {
        if (cancelled || !data?.success || !data.alert) return;
        setHasOverdue(Boolean(data.alert.hasOverdue));
      })
      .catch(() => {
        if (!cancelled) setHasOverdue(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasOverdue) return null;

  return (
    <section
      className="rounded-xl border border-(--error)/40 bg-(--error)/10 p-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <IconWarning className="mt-0.5 h-6 w-6 shrink-0 text-(--error)" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-(--error)">{t("dashboardContractPaymentOverdueTitle")}</p>
          <p className="mt-1 text-xs text-(--text-secondary)">{t("dashboardContractPaymentOverdueBody")}</p>
          <p className="mt-2 text-xs font-medium text-(--text-primary)">
            {t("dashboardContractPaymentOverdueAmicableHint")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => navigate({ name: "support" })}
              className="btn-primary inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-medium"
            >
              {t("dashboardContractPaymentOverdueSupportCta")}
            </button>
            <button
              type="button"
              onClick={() => navigate({ name: "billing" })}
              className="btn-secondary inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-medium"
            >
              {t("dashboardContractPaymentOverdueCta")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
