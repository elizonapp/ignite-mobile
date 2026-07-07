import { ArrowLeft } from "lucide-react";
import { cn } from "../../lib/utils";

export function SettingsSubView({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 mx-auto flex w-full max-w-screen lg:max-w-6xl flex-1 flex-col page-fullwidth">
      <div className="safe-x safe-top flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-(--text-primary)">{title}</h1>
      </div>
      <main className="safe-x safe-bottom flex-1 space-y-4 overflow-y-auto p-4">{children}</main>
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass space-y-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function SettingsNavRow({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="glass glass-hover w-full rounded-xl p-3 text-left">
      <div className="flex items-center gap-3">
        <span className={cn("shrink-0 text-(--text-muted)", danger && "text-(--error)")}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", danger ? "text-(--error)" : "text-(--text-primary)")}>{label}</p>
          {hint && <p className="mt-0.5 text-[11px] text-(--text-muted)">{hint}</p>}
        </div>
      </div>
    </button>
  );
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-(--text-primary)">{label}</p>
        {description && <p className="mt-0.5 text-xs text-(--text-muted)">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-(--primary-alt)" : "bg-(--surface-soft)",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white transition-all",
            checked ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

export function SettingsInlineRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-(--text-muted)">{icon}</span>}
        <span className="text-sm text-(--text-primary)">{label}</span>
      </div>
      {children}
    </div>
  );
}
