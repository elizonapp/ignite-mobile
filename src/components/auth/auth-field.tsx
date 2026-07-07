import { authInputBaseClass, authInputErrorClass, authInputOkClass } from "./auth-styles";

type AuthFieldProps = {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: string;
  labelAction?: React.ReactNode;
  children?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function AuthField({
  id,
  label,
  error,
  hint,
  labelAction,
  className,
  children,
  ...inputProps
}: AuthFieldProps) {
  const inputClass = `${authInputBaseClass} ${error ? authInputErrorClass : authInputOkClass} ${className ?? ""}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-(--text-primary)">
          {label}
        </label>
        {labelAction}
      </div>
      {children ?? <input id={id} className={inputClass} {...inputProps} />}
      {hint && !error && <p className="mt-1.5 text-xs text-(--text-muted)">{hint}</p>}
      {error && <p className="mt-1.5 text-sm text-(--error)">{error}</p>}
    </div>
  );
}
