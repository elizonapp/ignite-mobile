import { getApiBaseUrl } from "./config";
import { getApiErrorCode, resolveApiError } from "../api/resolve-error";
import { AuthResource } from "../api/auth";
import { DashboardResource } from "../api/dashboard";
import { BillingResource } from "../api/billing";
import { CheckoutResource } from "../api/checkout";
import { ShopResource } from "../api/shop";
import { FamilyResource } from "../api/family";
import { ServicesResource } from "../api/services";
import { SupportResource } from "../api/support";
import { UserResource } from "../api/user";
import { WalletResource } from "../api/wallet";
import { BusinessResource } from "../api/business";
import { AffiliatesResource } from "../api/affiliates";
import { DomainsResource } from "../api/domains";
import { IpManagerResource } from "../api/ip-manager";
import { SshKeysResource } from "../api/ssh-keys";
import { SubdomainsResource } from "../api/subdomains";
import type { QueryParams } from "../api/types";
import { SettingsResource } from "../api/settings";
import { FloatingIpsResource } from "../api/floating-ips";
import { ByoipResource } from "../api/byoip";
import { ElizonPlusResource } from "../api/elizon-plus";
import { PublicResource } from "../api/public";
import { getElizonClientKind, getElizonPlatformHeader } from "./platform";
import { clearSessionToken, getSessionToken, setSessionToken } from "./session-token";
import { de } from "../i18n/de";
import { en } from "../i18n/en";

export { clearSessionToken, getSessionToken, initSessionToken, setSessionToken } from "./session-token";

function mobileTranslate(key: string): string {
  if (typeof window === "undefined") return de[key as keyof typeof de] ?? key;
  const lang = window.localStorage.getItem("elizon.lang");
  const dict = lang === "en" ? en : de;
  return dict[key as keyof typeof dict] ?? en[key as keyof typeof en] ?? key;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  code: string | null;

  constructor(message: string, status: number, payload: unknown, code?: string | null) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.code = code ?? getApiErrorCode(payload);
  }
}

function resolveFailureMessage(parsed: unknown, semanticStatus: number): string {
  if (parsed && typeof parsed === "object") {
    return resolveApiError(parsed, mobileTranslate, { fallbackKey: "apiErrorUnknown" });
  }
  return `HTTP ${semanticStatus}`;
}

type RequestInitJson = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  query?: QueryParams;
};

export function isApiFailure(response: Response, body: unknown): boolean {
  const semantic =
    body !== null &&
    typeof body === "object" &&
    typeof (body as { status?: unknown }).status === "number"
      ? Number((body as { status: number }).status)
      : response.status;

  if (body !== null && typeof body === "object") {
    if (typeof (body as { ok?: unknown }).ok === "boolean") {
      return !(body as { ok: boolean }).ok;
    }
    if ((body as { success?: unknown }).success === false) {
      return true;
    }
  }

  return semantic < 200 || semantic >= 300;
}

function buildUrl(path: string, query?: QueryParams): string {
  const base = getApiBaseUrl();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildClientHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "X-Elizon-Client": getElizonClientKind(),
    "X-Elizon-Platform": getElizonPlatformHeader(),
    ...(extra ?? {}),
  };
}

async function executeFetch<T>(path: string, init: RequestInitJson = {}): Promise<T> {
  const { body, headers, query, ...rest } = init;
  const isJson = body !== undefined && !(body instanceof FormData);
  const token = getSessionToken();

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...buildClientHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isJson ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    body: isJson ? JSON.stringify(body) : (body as BodyInit | null | undefined),
  });

  let parsed: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    parsed = await response.json().catch(() => null);
  } else if (response.status !== 204) {
    parsed = await response.text().catch(() => null);
  }

  const semanticStatus =
    parsed && typeof parsed === "object" && typeof (parsed as { status?: unknown }).status === "number"
      ? Number((parsed as { status: number }).status)
      : response.status;

  const apiFailed =
    parsed !== null && typeof parsed === "object"
      ? isApiFailure(response, parsed)
      : !response.ok;

  if (apiFailed) {
    if (
      semanticStatus === 401 ||
      (parsed &&
        typeof parsed === "object" &&
        (parsed as { message?: unknown }).message === "unauthenticated")
    ) {
      clearSessionToken();
    }

    const message = resolveFailureMessage(parsed, semanticStatus);
    throw new ApiError(message, semanticStatus, parsed);
  }

  return parsed as T;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInitJson = {}): Promise<T> {
  return executeFetch<T>(path, init);
}

export class ApiClient {
  public readonly auth = new AuthResource(this);
  public readonly dashboard = new DashboardResource(this);
  public readonly billing = new BillingResource(this);
  public readonly checkout = new CheckoutResource(this);
  public readonly shop = new ShopResource(this);
  public readonly family = new FamilyResource(this);
  public readonly services = new ServicesResource(this);
  public readonly domains = new DomainsResource(this);
  public readonly subdomains = new SubdomainsResource(this);
  public readonly ipManager = new IpManagerResource(this);
  public readonly sshKeys = new SshKeysResource(this);
  public readonly support = new SupportResource(this);
  public readonly user = new UserResource(this);
  public readonly wallet = new WalletResource(this);
  public readonly business = new BusinessResource(this);
  public readonly affiliates = new AffiliatesResource(this);
  public readonly byoip = new ByoipResource(this);
  public readonly floatingIps = new FloatingIpsResource(this);
  public readonly publicApi = new PublicResource(this);
  public readonly settings = new SettingsResource(this);
  public readonly elizonPlus = new ElizonPlusResource(this);

  get<T>(path: string, query?: QueryParams) {
    return this.request<T>(path, { method: "GET", query });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "POST", body });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "PATCH", body });
  }

  delete<T>(path: string, query?: QueryParams, body?: unknown) {
    return this.request<T>(path, { method: "DELETE", query, body });
  }

  request<T = unknown>(path: string, init: RequestInitJson = {}): Promise<T> {
    return executeFetch<T>(path, init);
  }
}

export const api = new ApiClient();
