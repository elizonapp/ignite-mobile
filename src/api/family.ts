import { ResourceClient } from "./resource-client";

export class FamilyResource extends ResourceClient {
  group() {
    return this.get<{ success: boolean; group: unknown | null }>("/api/family");
  }

  create(name: string) {
    return this.post<{ success: boolean; group?: unknown; error?: string }>("/api/family", { name });
  }

  invites(groupId: string) {
    return this.get<{ success: boolean; invites: unknown[] }>(`/api/family/${groupId}/invites`);
  }

  members(groupId: string) {
    return this.get<{ success: boolean; members: unknown[] }>(`/api/family/${groupId}/members`);
  }

  invite(groupId: string, email: string, role: string) {
    return this.post<{ success: boolean; invite?: unknown; error?: string }>(`/api/family/${groupId}/invites`, {
      email,
      role,
    });
  }

  balanceRequests(groupId: string, status?: string) {
    return this.get<{ success: boolean; requests: unknown[] }>(`/api/family/${groupId}/balance-requests`, {
      status,
    });
  }

  removeMember(groupId: string, userId: string) {
    return this.delete<{ success: boolean; error?: string }>(
      `/api/family/${groupId}/members/${encodeURIComponent(userId)}`,
    );
  }

  updateMember(groupId: string, userId: string, body: { role?: string; familyBillingMode?: string | null }) {
    return this.patch<{ success: boolean; error?: string }>(
      `/api/family/${groupId}/members/${encodeURIComponent(userId)}`,
      body,
    );
  }
}
