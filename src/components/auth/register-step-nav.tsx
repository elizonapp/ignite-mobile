type RegisterStepNavProps = {
  onBack: () => void;
  backLabel: string;
  submitLabel: string;
  submitDisabled?: boolean;
  submitLoading?: boolean;
  submitType?: "button" | "submit";
  onSubmit?: () => void;
};

export function RegisterStepNav({
  onBack,
  backLabel,
  submitLabel,
  submitDisabled = false,
  submitLoading = false,
  submitType = "submit",
  onSubmit,
}: RegisterStepNavProps) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onBack}
        disabled={submitLoading}
        className="inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--border) bg-(--bg-elevated) px-4 py-3 text-sm font-medium text-(--text-secondary) transition-colors hover:border-(--primary)/40 hover:bg-(--primary)/5 hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </button>
      <button
        type={submitType}
        onClick={onSubmit}
        disabled={submitDisabled || submitLoading}
        className="btn-primary inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {submitLabel}
          </>
        ) : (
          <>
            {submitLabel}
            {submitType === "submit" && (
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </>
        )}
      </button>
    </div>
  );
}
