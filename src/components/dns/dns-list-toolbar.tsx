import { Plus, RefreshCw } from "lucide-react";

import { cn } from "../../lib/utils";

type DnsListToolbarProps = {
  addLabel: string;
  onAdd: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  addDisabled?: boolean;
};

export function DnsListToolbar({
  addLabel,
  onAdd,
  onRefresh,
  isRefreshing = false,
  addDisabled = false,
}: DnsListToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        className="glass glass-hover flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-(--text-secondary) disabled:opacity-50"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
        aria-label="Refresh"
      >
        <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
      </button>
    </div>
  );
}
