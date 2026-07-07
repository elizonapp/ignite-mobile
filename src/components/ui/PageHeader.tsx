import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "../../lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("safe-x safe-top flex items-center gap-3 px-4 py-3", className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
        >
          <ArrowLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-(--text-primary)">{title}</h1>
        {subtitle && <p className="truncate text-xs text-(--text-muted)">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
