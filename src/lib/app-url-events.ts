import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

import type { Route } from "../components/Router";
import { tryResolveElizonAppRoute } from "./app-url-router";

type AppUrlRouterPlugin = {
  addListener(
    eventName: "elizonAppUrl",
    listenerFunc: (event: { url: string }) => void,
  ): Promise<PluginListenerHandle>;
};

const AppUrlRouter = registerPlugin<AppUrlRouterPlugin>("AppUrlRouter");

type AppUrlHandler = (url: string) => void;

let handler: AppUrlHandler | null = null;
let capHandle: PluginListenerHandle | null = null;
let domBound = false;

function dispatchUrl(url: string) {
  if (!url || !handler) return;
  handler(url);
}

function onDomEvent(event: Event) {
  const detail = (event as CustomEvent<{ url?: string }>).detail;
  if (detail?.url) dispatchUrl(detail.url);
}

/**
 * Register a single global handler for elizon.app URLs discovered via
 * native WebView intercept (Android) or DOM CustomEvent fallback.
 */
export function setAppUrlEventHandler(next: AppUrlHandler | null) {
  handler = next;
}

export async function bindAppUrlEvents(): Promise<() => void> {
  if (!domBound) {
    window.addEventListener("elizon:app-url", onDomEvent);
    domBound = true;
  }

  if (Capacitor.isNativePlatform() && !capHandle) {
    try {
      capHandle = await AppUrlRouter.addListener("elizonAppUrl", (event) => {
        if (event?.url) dispatchUrl(event.url);
      });
    } catch {
      // Plugin missing on web / iOS until native counterpart exists.
    }
  }

  return () => {
    window.removeEventListener("elizon:app-url", onDomEvent);
    domBound = false;
    void capHandle?.remove();
    capHandle = null;
    handler = null;
  };
}

/** Resolve URL to a route; returns null when not mappable. */
export function routeFromAppUrlEvent(url: string): Route | null {
  return tryResolveElizonAppRoute(url);
}
