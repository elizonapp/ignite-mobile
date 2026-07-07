import { ResourceClient } from "./resource-client";

export class SshKeysResource extends ResourceClient {
  list() {
    return this.get<{ success: boolean; sshKeys: unknown[]; limitUsed: number; limitMax: number }>("/api/ssh-keys");
  }

  create(body: { name: string; publicKey: string }) {
    return this.post<{ success: boolean; error?: string }>("/api/ssh-keys", body);
  }

  delete(id: string) {
    return this.delete<{ success: boolean }>(`/api/ssh-keys/${id}`);
  }

  generate(body: { name: string; keyType: string; passphrase?: string }) {
    return this.post<{ success: boolean; privateKey: string; publicKey: string; error?: string }>(
      "/api/ssh-keys/generate",
      body,
    );
  }
}
