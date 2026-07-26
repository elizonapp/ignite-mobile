import type { Route } from "../components/Router";
import { API_BASE_URL } from "./config";

const ELIZON_HOSTS = new Set(["elizon.app", "www.elizon.app"]);

const DASHBOARD: Route = { name: "dashboard" };

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "/";
}

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * True when the URL points at the elizon web app (hardcoded production host).
 */
export function isElizonAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url, API_BASE_URL);
    return ELIZON_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function mapDashboardPath(pathname: string, searchParams: URLSearchParams): Route {
  const path = normalizePath(pathname);

  if (path === "/" || path === "/dashboard") return DASHBOARD;

  if (startsWithPath(path, "/dashboard/settings/id-verification")) {
    return { name: "settings", view: "id-verification" };
  }
  if (startsWithPath(path, "/dashboard/settings")) {
    const view = searchParams.get("view") ?? searchParams.get("tab");
    if (view === "id-verification" || view === "kyc") {
      return { name: "settings", view: "id-verification" };
    }
    return { name: "settings" };
  }

  if (startsWithPath(path, "/dashboard/services")) {
    const match = path.match(/^\/dashboard\/services\/([^/]+)/);
    if (match?.[1]) return { name: "server", id: decodeURIComponent(match[1]) };
    return { name: "servers" };
  }

  if (startsWithPath(path, "/dashboard/servers")) {
    const match = path.match(/^\/dashboard\/servers\/([^/]+)/);
    if (match?.[1]) return { name: "server", id: decodeURIComponent(match[1]) };
    return { name: "servers" };
  }

  if (startsWithPath(path, "/dashboard/console")) {
    const match = path.match(/^\/dashboard\/console\/([^/]+)/);
    if (match?.[1]) return { name: "console", id: decodeURIComponent(match[1]) };
    return { name: "servers" };
  }

  if (startsWithPath(path, "/dashboard/support")) return { name: "support" };
  if (startsWithPath(path, "/dashboard/billing") || startsWithPath(path, "/dashboard/wallet")) {
    return { name: "billing" };
  }
  if (startsWithPath(path, "/dashboard/invoices")) {
    const pay = path.match(/^\/dashboard\/invoices\/([^/]+)\/pay/);
    if (pay?.[1]) return { name: "invoice-pay", id: decodeURIComponent(pay[1]) };
    const detail = path.match(/^\/dashboard\/invoices\/([^/]+)/);
    if (detail?.[1]) return { name: "invoice-detail", id: decodeURIComponent(detail[1]) };
    return { name: "invoices" };
  }
  if (startsWithPath(path, "/dashboard/elizon-plus")) return { name: "elizon-plus" };
  if (startsWithPath(path, "/dashboard/storage")) return { name: "storage" };
  if (startsWithPath(path, "/dashboard/subdomains")) return { name: "subdomains" };
  if (startsWithPath(path, "/dashboard/domains")) return { name: "domains" };
  if (startsWithPath(path, "/dashboard/ip-manager")) return { name: "ip-manager" };
  if (startsWithPath(path, "/dashboard/byoip")) return { name: "byoip" };
  if (startsWithPath(path, "/dashboard/floating-ips")) return { name: "floating-ips" };
  if (startsWithPath(path, "/dashboard/ssh-keys")) return { name: "ssh-keys" };
  if (startsWithPath(path, "/dashboard/affiliate")) return { name: "affiliate" };
  if (startsWithPath(path, "/dashboard/feedback")) return { name: "feedback" };
  if (startsWithPath(path, "/dashboard/business")) return { name: "business" };
  if (startsWithPath(path, "/dashboard/family")) return { name: "family" };
  if (startsWithPath(path, "/dashboard/vroute")) return { name: "vroute" };
  if (startsWithPath(path, "/dashboard/monthly-offers")) return { name: "monthly-offers" };

  if (startsWithPath(path, "/dashboard/permissions/accept")) {
    const id =
      searchParams.get("permissionId") ??
      searchParams.get("id") ??
      path.split("/").filter(Boolean).pop();
    if (id && id !== "accept") return { name: "permission-accept", permissionId: id };
    return DASHBOARD;
  }

  if (startsWithPath(path, "/dashboard")) return DASHBOARD;

  return DASHBOARD;
}

function mapAuthPath(pathname: string, searchParams: URLSearchParams, depth: number): Route {
  const returnUrl = searchParams.get("returnUrl") ?? searchParams.get("return_url");
  if (returnUrl) {
    try {
      const absolute = new URL(returnUrl, API_BASE_URL).toString();
      return resolveAppRoute(absolute, depth + 1);
    } catch {
      // fall through
    }
  }
  return DASHBOARD;
}

/**
 * Map an absolute or relative elizon web URL to an in-app Route.
 * Always returns a route; unknown / blocked purchase paths → dashboard.
 */
export function resolveAppRoute(url: string, depth = 0): Route {
  if (depth > 4) return DASHBOARD;

  let parsed: URL;
  try {
    parsed = new URL(url, API_BASE_URL);
  } catch {
    return DASHBOARD;
  }

  const pathname = normalizePath(parsed.pathname);
  const { searchParams } = parsed;

  // Purchase / admin surfaces are unavailable in the native app.
  if (
    startsWithPath(pathname, "/products") ||
    startsWithPath(pathname, "/checkout") ||
    startsWithPath(pathname, "/admin")
  ) {
    return DASHBOARD;
  }

  if (startsWithPath(pathname, "/auth")) {
    return mapAuthPath(pathname, searchParams, depth);
  }

  if (pathname === "/" || startsWithPath(pathname, "/dashboard")) {
    return mapDashboardPath(pathname, searchParams);
  }

  // Shop-style public paths also bounce home (native purchase disabled).
  if (startsWithPath(pathname, "/shop") || startsWithPath(pathname, "/cart")) {
    return DASHBOARD;
  }

  return DASHBOARD;
}

/** Web-only auth/legal paths — no native screen; keep out of in-app routing. */
function isWebOnlyElizonPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    startsWithPath(path, "/auth/forgot-password") ||
    startsWithPath(path, "/auth/reset-password") ||
    startsWithPath(path, "/legal") ||
    startsWithPath(path, "/datenschutz") ||
    startsWithPath(path, "/privacy") ||
    startsWithPath(path, "/terms") ||
    startsWithPath(path, "/agb")
  );
}

/**
 * Resolve only when the URL is on elizon.app and maps to a native screen.
 * Returns null for third-party URLs and web-only elizon paths (forgot-password, …).
 */
export function tryResolveElizonAppRoute(url: string): Route | null {
  if (!isElizonAppUrl(url)) return null;
  try {
    const parsed = new URL(url, API_BASE_URL);
    if (isWebOnlyElizonPath(parsed.pathname)) return null;
  } catch {
    return null;
  }
  return resolveAppRoute(url);
}
