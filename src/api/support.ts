import { ResourceClient } from "./resource-client";

export class SupportResource extends ResourceClient {
  tickets(limit = 100, status?: string) {
    return this.get<{ success: boolean; tickets: unknown[]; stats?: unknown; pagination?: { total: number } }>(
      "/api/tickets",
      { limit, ...(status ? { status } : {}) },
    );
  }

  ticket(id: string) {
    return this.get<{ success: boolean; ticket: unknown }>(`/api/tickets/${id}`);
  }

  createTicket(body: { subject: string; message: string; priority: string }) {
    return this.post<{ success: boolean; ticket?: unknown; error?: string }>("/api/tickets", body);
  }

  reply(ticketId: string, content: string) {
    return this.post<{ success: boolean; error?: string }>(`/api/tickets/${ticketId}/messages`, { content });
  }

  knowledgeBase(lang?: string) {
    return this.get<{ success: boolean; articles: unknown[] }>("/api/knowledge-base", { lang });
  }
}
