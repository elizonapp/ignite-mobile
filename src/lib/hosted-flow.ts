import type { Route } from "../components/Router";
import { tryResolveElizonAppRoute } from "./app-url-router";

export type HostedFlowOptions = {
  title?: string;
  /** Used when a framed redirect to elizon.app is blocked (XFO) and cannot be scraped. */
  fallbackRoute?: Route;
};

type HostedFlowNavigate = (url: string, options?: HostedFlowOptions) => void;
type AppRouteNavigate = (route: Route) => void;

let navigateToHostedFlow: HostedFlowNavigate | null = null;
let navigateToAppRoute: AppRouteNavigate | null = null;
let activeFallbackRoute: Route | null = null;

export function registerHostedFlowNavigate(handler: HostedFlowNavigate | null) {
  navigateToHostedFlow = handler;
}

export function registerAppRouteNavigate(handler: AppRouteNavigate | null) {
  navigateToAppRoute = handler;
}

export function setActiveHostedFlowFallback(route: Route | null) {
  activeFallbackRoute = route;
}

export function getActiveHostedFlowFallback(): Route | null {
  return activeFallbackRoute;
}

/**
 * Prefer KYC settings when a login bounce only targets generic settings.
 */
export function refineRouteWithHostedFallback(route: Route): Route {
  const fallback = activeFallbackRoute;
  if (
    fallback?.name === "settings" &&
    fallback.view === "id-verification" &&
    route.name === "settings" &&
    !("view" in route && route.view)
  ) {
    return fallback;
  }
  return route;
}

/**
 * Opens a URL inside the app. elizon.app paths become native routes;
 * third-party URLs use the hosted-flow iframe screen.
 */
export function openHostedFlow(url: string, options?: HostedFlowOptions) {
  const appRoute = tryResolveElizonAppRoute(url);
  if (appRoute) {
    activeFallbackRoute = null;
    navigateToAppRoute?.(refineRouteWithHostedFallback(appRoute));
    return;
  }

  if (navigateToHostedFlow) {
    activeFallbackRoute = options?.fallbackRoute ?? null;
    navigateToHostedFlow(url, options);
    return;
  }

  window.location.assign(url);
}
