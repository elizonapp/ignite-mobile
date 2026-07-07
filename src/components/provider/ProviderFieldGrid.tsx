import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { useProviderT } from "./use-provider-t";
import { formatResolvedFieldValue, hasResolvedFieldDisplayValue } from "./format-field";
import type { ResolvedField } from "./types";

function CopyableValue({ text, label }: { text: string; label: string }) {
  const t = useProviderT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-sm text-(--text-primary)" title={text}>
          {text}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-(--text-muted)">{label}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-(--text-muted) transition-colors hover:bg-white/10 hover:text-(--text-primary)"
        aria-label={copied ? t("providerFieldCopied") : t("providerFieldCopy")}
        title={copied ? t("providerFieldCopied") : t("providerFieldCopy")}
      >
        {copied ? <Check className="size-4 text-(--success)" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

/**
 * Renders resolved schema fields as read-only spec cards, badges and copyable
 * values. The mobile detail is read-only; editable configurator fields live in
 * the desktop checkout flow.
 */
export function ProviderFieldGrid({ fields, className }: { fields: ResolvedField[]; className?: string }) {
  const t = useProviderT();
  const visibleFields = fields.filter((f) => f.visible !== false && hasResolvedFieldDisplayValue(f));

  if (visibleFields.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 gap-2.5 ${className ?? ""}`}>
      {visibleFields.map((field) => {
        const label = t(field.labelKey);
        const spanClass = field.grid?.fullWidth ? "col-span-2" : "";
        const displayText = formatResolvedFieldValue(field, t) ?? "";

        return (
          <div key={field.key} className={`glass p-3.5 ${spanClass}`}>
            {field.format === "copyable" ? (
              <CopyableValue text={displayText} label={label} />
            ) : field.format === "badge" ? (
              <div>
                <span className="inline-flex items-center rounded-full border border-(--border) bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-(--text-primary)">
                  {displayText}
                </span>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-(--text-muted)">{label}</div>
              </div>
            ) : (
              <div>
                <div className="truncate text-base font-semibold text-(--text-primary)" title={displayText}>
                  {displayText}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-(--text-muted)">{label}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
