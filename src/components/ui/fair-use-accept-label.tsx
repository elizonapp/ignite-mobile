import { useI18n } from "../../i18n";
import { useLegal } from "../legal/LegalProvider";

type FairUseAcceptLabelProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  acceptPrefix: string;
  acceptSuffix: string;
  policyLabel: string;
  className?: string;
};

export function FairUseAcceptLabel({
  checked,
  onChange,
  acceptPrefix,
  acceptSuffix,
  policyLabel,
  className = "",
}: FairUseAcceptLabelProps) {
  const { openLegal } = useLegal();

  return (
    <label
      className={`flex min-h-11 cursor-pointer select-none items-center gap-2.5 ${className}`.trim()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 cursor-pointer rounded border-(--border) accent-(--elizon-primary)"
      />
      <span className="min-w-0 flex-1 text-sm leading-normal text-(--text-secondary)">
        {acceptPrefix}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openLegal("fair-use");
          }}
          className="text-(--elizon-primary) underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {policyLabel}
        </button>
        {acceptSuffix}
      </span>
    </label>
  );
}

export function useFairUseAcceptCopy() {
  const { t } = useI18n();
  const parts = t("acceptFairUsePolicy").split("{link}");
  return {
    acceptPrefix: parts[0] ?? "",
    acceptSuffix: parts[1] ?? "",
    policyLabel: t("fairUsePolicyLabel"),
  };
}
