// Type-only mirror of lib/core/providers/modules/types.ts (client-safe subset).
// Kept in-repo so ignite-mobile builds standalone after mirror sync.

export type ProviderSurface = "category" | "product" | "service" | "admin_config";

export type FieldFormat =
  | "text"
  | "number"
  | "vcpu"
  | "memory_gb"
  | "memory_mb"
  | "storage_gb"
  | "bandwidth_tb"
  | "network_mbs"
  | "network_mbit"
  | "currency"
  | "badge"
  | "copyable"
  | "percent_cpu"
  | "date"
  | "boolean";

export type VisibilityRule =
  | { type: "always" }
  | { type: "never" }
  | { type: "capability"; key: string; equals?: boolean }
  | { type: "flag"; path: string; equals?: unknown }
  | { type: "permission"; permission: string }
  | { type: "and"; rules: VisibilityRule[] }
  | { type: "or"; rules: VisibilityRule[] }
  | { type: "not"; rule: VisibilityRule };

export type ValidationRule =
  | { type: "required"; messageKey?: string }
  | { type: "min"; value: number; messageKey?: string }
  | { type: "max"; value: number; messageKey?: string }
  | { type: "pattern"; value: string; messageKey?: string };

export type FieldOption = { value: string; label: string };

export type SlotDef = {
  fields?: string[];
  widgets?: WidgetSlot[];
  actions?: string[];
};

export type SectionDef = {
  id: string;
  labelKey?: string;
  tier?: 1 | 2 | 3;
  slots?: SlotDef[];
  fields?: string[];
  widgets?: WidgetSlot[];
};

export type TabDef = {
  id: string;
  labelKey: string;
  tier?: 2 | 3;
  widgets?: WidgetSlot[];
  fields?: string[];
  actions?: string[];
  visibleWhen?: VisibilityRule;
};

export type LayoutBlueprint = {
  id: string;
  surface: ProviderSurface;
  header?: SlotDef[];
  sections?: SectionDef[];
  tabs?: TabDef[];
  advanced?: SectionDef[];
};

export type FieldSpec = {
  key: string;
  labelKey: string;
  source: string;
  format: FieldFormat;
  visibleWhen?: VisibilityRule;
  editable?: boolean;
  validation?: ValidationRule[];
  grid?: { cols?: 1 | 2 | 3; fullWidth?: boolean };
  options?: FieldOption[];
  dataSource?: { api: string };
  step?: number;
};

export type ConfirmSpec = {
  titleKey: string;
  messageKey: string;
  confirmLabelKey: string;
  cancelLabelKey: string;
  requireResourceName?: boolean;
};

export type AdapterActionMethod =
  | "start"
  | "stop"
  | "restart"
  | "reset"
  | "suspend"
  | "resume"
  | "terminate";

export type ActionHandler =
  | { type: "adapter"; method: AdapterActionMethod }
  | { type: "api"; route: string; method?: "POST" | "GET" | "PUT" | "DELETE" }
  | { type: "override"; handlerId: string };

export type ActionBinding = {
  key: string;
  labelKey: string;
  icon: string;
  tier: 1 | 2 | 3;
  visibleWhen: VisibilityRule;
  disabledWhen?: VisibilityRule;
  confirm?: ConfirmSpec;
  handler: ActionHandler;
};

export type WidgetSlot = {
  widget: string;
  props?: Record<string, unknown>;
  dataSource?: { api: string; pollMs?: number };
  visibleWhen?: VisibilityRule;
};

export type ResolvedField = FieldSpec & {
  value: unknown;
  formatted: string;
  visible: boolean;
};

export type SerializedAction = ActionBinding & {
  visible: boolean;
  disabled: boolean;
};
