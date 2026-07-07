// ============================================
// PROVIDER UI — MOBILE CLIENT TYPES
// Type-only mirrors of the serialized ViewModel shapes produced by
// lib/core/providers/modules/serialize-view.ts. Only `import type` /
// `export type` from the module framework — no runtime imports of
// server-only code (the paths resolve to the shared repo lib, same
// pattern as src/api/resolve-error.ts).
// ============================================

export type {
  ActionBinding,
  ConfirmSpec,
  FieldFormat,
  FieldSpec,
  LayoutBlueprint,
  ProviderSurface,
  ResolvedField,
  SectionDef,
  SerializedAction,
  SlotDef,
  TabDef,
  ValidationRule,
  VisibilityRule,
  WidgetSlot,
} from "../../../../../lib/core/providers/modules/types";

import type {
  LayoutBlueprint,
  ResolvedField,
  SerializedAction,
  TabDef,
  WidgetSlot,
} from "../../../../../lib/core/providers/modules/types";
import type { DashboardServer } from "../../lib/types";
import type { ServiceNetwork } from "../../hooks/useServiceDetail";

/** Compact identity block from GET /api/services/:id/view for the shell header. */
export type ProviderViewIdentity = {
  name: string;
  displayName: string | null;
  status: string | null;
  primaryIpv4: string | null;
  primaryIpv6: string | null;
  productName: string | null;
  node: string | null;
  region: string | null;
};

/** Normalized client view of GET /api/services/:id/view. */
export type ProviderView = {
  providerType: string;
  layout: LayoutBlueprint;
  /** Ebene 2 — tabs (service view returns them explicitly, falls back to layout). */
  tabs: TabDef[];
  fields: ResolvedField[];
  /** Ebene 1 — overview fields (falls back to fields). */
  overviewFields: ResolvedField[];
  actions: SerializedAction[];
  widgets: WidgetSlot[];
  identity: ProviderViewIdentity | null;
};

/** Raw JSON shape of GET /api/services/:id/view. */
export type RawProviderViewResponse = {
  success: boolean;
  enabled?: boolean;
  error?: string;
  providerType?: string;
  layout?: LayoutBlueprint;
  tabs?: TabDef[];
  fields?: ResolvedField[];
  overviewFields?: ResolvedField[];
  actions?: SerializedAction[];
  widgets?: WidgetSlot[];
  identity?: ProviderViewIdentity | null;
};

/** Response of POST /api/services/:id/actions/:key. */
export type ActionDispatchResponse = {
  success: boolean;
  message?: string;
  error?: string;
  status?: string | null;
  data?: Record<string, unknown>;
};

/**
 * Access flags relevant for the mobile provider view. Sourced from
 * GET /api/services/:id (server.access) — the view endpoint itself carries none.
 */
export type ProviderViewAccess = {
  canManageBilling?: boolean;
};

/**
 * Context handed to every mobile widget. Carries the already-loaded service
 * data so widgets (resource usage, IPs, console) reuse it without refetching.
 */
export type ProviderWidgetContext = {
  server?: DashboardServer | null;
  network?: ServiceNetwork | null;
  onRefresh?: () => void;
  onOpenConsole?: () => void;
};

/** Props every mobile provider widget component receives from the widget host. */
export type ProviderWidgetProps = {
  slot: WidgetSlot;
  serviceId?: string;
  context?: ProviderWidgetContext;
};
