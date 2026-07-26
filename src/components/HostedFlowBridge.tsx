import { useEffect } from "react";

import { bindAppUrlEvents, setAppUrlEventHandler } from "../lib/app-url-events";
import {
  refineRouteWithHostedFallback,
  registerAppRouteNavigate,
  registerHostedFlowNavigate,
  setActiveHostedFlowFallback,
} from "../lib/hosted-flow";
import { tryResolveElizonAppRoute } from "../lib/app-url-router";
import { useRouter } from "./Router";

export function HostedFlowBridge() {
  const { navigate } = useRouter();

  useEffect(() => {
    registerAppRouteNavigate((route) => {
      navigate(route);
    });
    registerHostedFlowNavigate((url, options) => {
      const appRoute = tryResolveElizonAppRoute(url);
      if (appRoute) {
        setActiveHostedFlowFallback(null);
        navigate(refineRouteWithHostedFallback(appRoute));
        return;
      }
      setActiveHostedFlowFallback(options?.fallbackRoute ?? null);
      navigate({
        name: "hosted-flow",
        url,
        title: options?.title,
        fallbackRoute: options?.fallbackRoute,
      });
    });

    setAppUrlEventHandler((url) => {
      const route = tryResolveElizonAppRoute(url);
      if (!route) return;
      navigate(refineRouteWithHostedFallback(route));
      setActiveHostedFlowFallback(null);
    });

    let unbind: (() => void) | undefined;
    let cancelled = false;
    void bindAppUrlEvents().then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unbind = fn;
    });

    return () => {
      cancelled = true;
      unbind?.();
      setAppUrlEventHandler(null);
      setActiveHostedFlowFallback(null);
      registerAppRouteNavigate(null);
      registerHostedFlowNavigate(null);
    };
  }, [navigate]);

  return null;
}
