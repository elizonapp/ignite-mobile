import type { ApiTransport, QueryParams } from "./types";

export abstract class ResourceClient {
  protected readonly client: ApiTransport;

  constructor(client: ApiTransport) {
    this.client = client;
  }

  protected get<T>(path: string, query?: QueryParams) {
    return this.client.get<T>(path, query);
  }

  protected post<T>(path: string, body?: unknown) {
    return this.client.post<T>(path, body);
  }

  protected put<T>(path: string, body?: unknown) {
    return this.client.put<T>(path, body);
  }

  protected patch<T>(path: string, body?: unknown) {
    return this.client.patch<T>(path, body);
  }

  protected delete<T>(path: string, query?: QueryParams, body?: unknown) {
    return this.client.delete<T>(path, query, body);
  }
}
