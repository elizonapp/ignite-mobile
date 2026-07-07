import * as React from "react";

import { cn } from '../../lib/utils';

type ProgressTone = "primary" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<ProgressTone, string> = {
  primary: "bg-(--elizon-primary)",
  accent: "bg-linear-to-r from-(--elizon-primary) to-(--elizon-accent)",
  success: "bg-linear-to-r from-(--elizon-accent) to-(--success)",
  warning: "bg-(--warning)",
  danger: "bg-(--error)",
};

type ProgressProps = React.ComponentProps<"div"> & {
  value?: number;
  tone?: ProgressTone;
};

function Progress({ className, value = 0, tone = "primary", ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-(--surface-strong)", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", toneClass[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
