import { X } from "lucide-react";
import type { ReactNode } from "react";

type ShopWizardShellProps = {
  title: string;
  subtitle?: string;
  stepIndex: number;
  stepCount: number;
  stepLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function ShopWizardShell({
  title,
  subtitle,
  stepIndex,
  stepCount,
  stepLabel,
  onClose,
  children,
  footer,
}: ShopWizardShellProps) {
  const progress = stepCount > 0 ? ((stepIndex + 1) / stepCount) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-(--bg-base)">
      <header className="safe-x border-b border-(--border) bg-(--bg-elevated) pt-2">
        <div className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-(--text-muted)">{stepLabel}</p>
            <h1 className="truncate text-lg font-semibold text-(--text-primary)">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-xs text-(--text-muted)">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-(--border) text-(--text-secondary) hover:bg-(--surface-soft)"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="pb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-(--border)">
            <div
              className="h-full rounded-full bg-(--elizon-primary) transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <div className="safe-x flex-1 overflow-y-auto py-5">{children}</div>

      {footer ? (
        <footer className="safe-x border-t border-(--border) bg-(--bg-elevated) py-3">{footer}</footer>
      ) : null}
    </div>
  );
}

export function WizardNav({
  onBack,
  onNext,
  backLabel,
  nextLabel,
  nextDisabled,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  backLabel: string;
  nextLabel: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {showBack && onBack ? (
        <button type="button" onClick={onBack} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        {nextLabel}
      </button>
    </div>
  );
}

export function WizardOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
        selected
          ? "border-(--elizon-primary) bg-(--elizon-primary)/10 text-(--text-primary)"
          : "border-(--border) text-(--text-secondary) hover:border-(--elizon-primary)/40"
      }`}
    >
      {label}
    </button>
  );
}

export function SpecStepper({
  label,
  value,
  unit,
  min,
  max,
  step,
  disabled,
  invalid,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: number) => void;
}) {
  const decrease = () => onChange(Math.max(min, value - step));
  const increase = () => onChange(Math.min(max, value + step));

  return (
    <div
      className={`rounded-xl border p-4 ${
        invalid ? "border-(--error)/60 bg-(--error)/5" : "border-(--border)"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-(--text-primary)">{label}</p>
          <p className="text-xs text-(--text-muted)">
            {value} {unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || value <= min}
            onClick={decrease}
            className="grid size-9 place-items-center rounded-lg border border-(--border) text-lg leading-none disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            disabled={disabled || value >= max}
            onClick={increase}
            className="grid size-9 place-items-center rounded-lg border border-(--border) text-lg leading-none disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
