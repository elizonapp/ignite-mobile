import { useI18n } from "../../i18n";
import type { MaintenanceNote } from "../../lib/types";
import { IconWarning } from "./dashboard-icons";

export function MaintenanceBanner({
  notes,
  onSelect,
}: {
  notes: MaintenanceNote[];
  onSelect: (serviceId: string) => void;
}) {
  const { t } = useI18n();
  if (!notes.length) return null;

  return (
    <section className="rounded-(--radius) border border-(--warning)/30 bg-(--warning)/10 p-3">
      <div className="flex items-start gap-2">
        <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-(--warning)" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-(--warning)">{t("maintenanceTitle")}</h3>
          <p className="mt-0.5 text-[11px] text-(--text-secondary)">{t("maintenanceIntro")}</p>
          <ul className="mt-2 space-y-1 text-[12px] text-(--text-primary)">
            {notes.slice(0, 4).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.serviceId)}
                  className="font-medium text-(--text-primary) underline-offset-2 hover:underline"
                >
                  {n.serviceName}
                </button>
                {n.title ? `: ${n.title}` : null}
              </li>
            ))}
          </ul>
          {notes.length > 4 && (
            <p className="mt-1 text-[11px] text-(--text-muted)">
              +{notes.length - 4} {t("more")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
