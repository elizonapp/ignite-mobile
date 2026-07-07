import { Progress } from '../ui/progress';
import { useI18n } from '../../i18n';
import type { DashboardServer } from '../../lib/types';

export function ResourceUsage({ servers }: { servers: DashboardServer[] }) {
  const { t } = useI18n();
  const sample = servers.filter(
    (s) => s.status === "online" && (s.providerType || "").toUpperCase() !== "MAILCOW"
  );

  const avgPct = (selector: (s: DashboardServer) => { used: number; total: number }) => {
    if (!sample.length) return 0;
    const total = sample.reduce((acc, s) => {
      const v = selector(s);
      return acc + (v.total > 0 ? v.used / v.total : 0);
    }, 0);
    return Math.min(100, Math.round((total / sample.length) * 100));
  };

  const cpu = avgPct((s) => s.cpu);
  const ram = avgPct((s) => s.ram);
  const disk = avgPct((s) => s.disk);
  const hasData = sample.length > 0;

  return (
    <section className="glass p-4">
      <h3 className="text-base font-semibold text-(--text-primary)">{t("resourceUsage")}</h3>

      <div className="mt-3 space-y-3">
        <Row label={t("serverCpu")} value={hasData ? `${cpu}%` : t("na")} pct={cpu} tone="primary" />
        <Row label={t("serverRam")} value={hasData ? `${ram}%` : t("na")} pct={ram} tone="primary" />
        <Row label={t("serverDisk")} value={hasData ? `${disk}%` : t("na")} pct={disk} tone="primary" />
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: "primary" | "accent" | "success";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-(--text-muted)">{label}</span>
        <span className="font-medium text-(--text-primary)">{value}</span>
      </div>
      <Progress className="mt-1.5" value={pct} tone={tone} />
    </div>
  );
}
