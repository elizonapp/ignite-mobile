import { ResourceClient } from "./resource-client";
import type {
  ActionDispatchResponse,
  RawProviderViewResponse,
} from "../components/provider/types";

export class ServicesResource extends ResourceClient {
  find(id: string) {
    return this.get<{ success: boolean; server?: unknown }>(`/api/services/${id}`);
  }

  list(limit = 50, view?: string) {
    return this.get<{ success: boolean; servers?: unknown[]; services?: unknown[]; pagination?: { total: number } }>(
      "/api/services",
      { limit, view },
    );
  }

  /** GET /api/services/:id/view — serialized provider ViewModel (tabs, widgets, actions, fields). */
  view(id: string) {
    return this.get<RawProviderViewResponse>(`/api/services/${encodeURIComponent(id)}/view`);
  }

  /** POST /api/services/:id/actions/:key — dispatch a schema action (start/stop/restart/…). */
  action(id: string, key: string, body?: Record<string, unknown>) {
    return this.post<ActionDispatchResponse>(
      `/api/services/${encodeURIComponent(id)}/actions/${encodeURIComponent(key)}`,
      body ?? {},
    );
  }

  statusBatch(ids: string[]) {
    return this.post<{ success: boolean; statuses: Record<string, Record<string, unknown>> }>(
      "/api/services/status-batch",
      { ids },
    );
  }
}
