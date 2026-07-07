import { cn } from "../../lib/utils";

type SkeletonBlockProps = {
  className?: string;
  lines?: number;
  height?: string;
};

export function SkeletonBlock({ className, lines = 1, height }: SkeletonBlockProps) {
  if (lines <= 1) {
    return (
      <div
        className={cn("animate-shimmer rounded-lg bg-(--surface-strong)", height ?? "h-4", className)}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-shimmer rounded-lg bg-(--surface-strong)",
            i === lines - 1 ? "h-3 w-2/3" : "h-4 w-full",
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3, itemClassName }: { count?: number; itemClassName?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("glass p-4 space-y-3", itemClassName)}>
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-3 w-1/2" />
          <div className="grid grid-cols-3 gap-3">
            <SkeletonBlock className="h-8" />
            <SkeletonBlock className="h-8" />
            <SkeletonBlock className="h-8" />
          </div>
        </div>
      ))}
    </div>
  );
}
