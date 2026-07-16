import { useEffect, useMemo, useState } from "react";

import { useI18n } from "../../i18n";
import type { ShopEggVariable, ShopPterodactylEgg } from "../../lib/shop-product-detail";

type EggEnvironmentFieldsProps = {
  egg: ShopPterodactylEgg;
  environmentValues: Record<string, string>;
  onEnvironmentChange: (key: string, value: string) => void;
  editableOnly?: boolean;
};

export function EggEnvironmentFields({
  egg,
  environmentValues,
  onEnvironmentChange,
  editableOnly = true,
}: EggEnvironmentFieldsProps) {
  const { t } = useI18n();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const variables = useMemo(() => {
    const list = egg.variables ?? [];
    return list.filter((v) =>
      editableOnly ? v.userViewable && v.userEditable : v.userViewable,
    );
  }, [egg.variables, editableOnly]);

  useEffect(() => {
    for (const v of egg.variables ?? []) {
      if (environmentValues[v.envVariable] === undefined && v.defaultValue) {
        onEnvironmentChange(v.envVariable, v.defaultValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init defaults when egg changes
  }, [egg.eggId]);

  if (variables.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-(--text-primary)">{t("selectConfiguration")}</h4>
      {variables.map((variable) => (
        <EggVariableInput
          key={variable.envVariable}
          variable={variable}
          value={environmentValues[variable.envVariable] ?? variable.defaultValue ?? ""}
          touched={!!touched[variable.envVariable]}
          onBlur={() => setTouched((prev) => ({ ...prev, [variable.envVariable]: true }))}
          onChange={(value) => onEnvironmentChange(variable.envVariable, value)}
        />
      ))}
    </div>
  );
}

function EggVariableInput({
  variable,
  value,
  touched,
  onBlur,
  onChange,
}: {
  variable: ShopEggVariable;
  value: string;
  touched: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
}) {
  const required = variable.rules?.includes("required");
  const showError = touched && required && !value.trim();

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-(--text-secondary)">
        {variable.name || variable.envVariable}
        {required ? <span className="ml-1 text-(--error)">*</span> : null}
      </label>
      {variable.description ? (
        <p className="mb-1 text-[11px] text-(--text-muted)">{variable.description}</p>
      ) : null}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-xl border bg-(--bg-elevated) px-3 py-2.5 text-sm ${
          showError ? "border-(--error)" : "border-(--border)"
        }`}
      />
    </div>
  );
}
