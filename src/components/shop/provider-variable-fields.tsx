import { useI18n } from "../../i18n";
import type { ShopProviderVariableSpec } from "../../lib/shop-product-detail";

type ProviderVariableFieldsProps = {
  variables: ShopProviderVariableSpec[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
};

export function ProviderVariableFields({
  variables,
  values,
  onChange,
  disabled = false,
}: ProviderVariableFieldsProps) {
  const { t, lang } = useI18n();

  if (variables.length === 0) return null;

  return (
    <div className="space-y-4">
      {variables.map((variable) => {
        const label = variable.labels?.[lang] || variable.labels?.en || variable.name;
        return (
          <div key={variable.name}>
            <label className="mb-1.5 block text-sm font-medium text-(--text-secondary)">
              {label}
              {variable.required ? <span className="ml-1 text-(--error)">*</span> : null}
            </label>
            {variable.type === "select" && variable.options ? (
              <select
                value={values[variable.name] || ""}
                onChange={(e) => onChange(variable.name, e.target.value)}
                disabled={disabled}
                className="w-full cursor-pointer rounded-xl border border-(--border) bg-(--bg-elevated) px-4 py-2.5 text-sm text-(--text-primary) disabled:opacity-50"
              >
                <option value="">{t("selectOption")}</option>
                {variable.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label || opt.value}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={values[variable.name] || ""}
                onChange={(e) => onChange(variable.name, e.target.value)}
                placeholder={variable.placeholderKey ? t(variable.placeholderKey as never) : label}
                disabled={disabled}
                className="w-full rounded-xl border border-(--border) bg-(--bg-elevated) px-4 py-2.5 text-sm text-(--text-primary) disabled:opacity-50"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
