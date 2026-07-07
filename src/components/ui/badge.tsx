import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-(--primary)/15 text-(--primary)",
        success:
          "border-transparent bg-(--success)/12 text-(--success)",
        warning:
          "border-transparent bg-(--warning)/15 text-(--warning)",
        danger:
          "border-transparent bg-(--error)/15 text-(--error)",
        muted:
          "border-transparent bg-(--surface-soft) text-(--text-muted)",
        outline:
          "border-(--border) text-(--text-secondary)",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
