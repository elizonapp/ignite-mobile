import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "../components/ui/button";
import { useRouter, type Route } from "../components/Router";
import { useI18n } from "../i18n";
import { isElizonAppUrl, tryResolveElizonAppRoute } from "../lib/app-url-router";
import { refineRouteWithHostedFallback, setActiveHostedFlowFallback } from "../lib/hosted-flow";
import { iframeLooksBlocked, probeIframeForElizonUrl } from "../lib/iframe-url-probe";

type HostedFlowScreenProps = {
  url: string;
  title?: string;
  fallbackRoute?: Route;
};

export function HostedFlowScreen({ url, title, fallbackRoute }: HostedFlowScreenProps) {
  const { t } = useI18n();
  const { back, navigate } = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blocked, setBlocked] = useState(false);
  const handledRef = useRef(false);

  const finishWithRoute = useCallback(
    (route: Route) => {
      if (handledRef.current) return false;
      handledRef.current = true;
      setActiveHostedFlowFallback(null);
      navigate(route);
      return true;
    },
    [navigate],
  );

  const goToAppRouteFromUrl = useCallback(
    (candidate: string) => {
      const route = tryResolveElizonAppRoute(candidate);
      if (!route) return false;
      return finishWithRoute(refineRouteWithHostedFallback(route));
    },
    [finishWithRoute],
  );

  const useFallback = useCallback(() => {
    if (!fallbackRoute) return false;
    return finishWithRoute(fallbackRoute);
  }, [fallbackRoute, finishWithRoute]);

  const absorbIframeNavigation = useCallback(() => {
    const probed = probeIframeForElizonUrl(iframeRef.current);
    if (probed && goToAppRouteFromUrl(probed)) return true;

    if (iframeLooksBlocked(iframeRef.current)) {
      if (probed && goToAppRouteFromUrl(probed)) return true;
      if (useFallback()) return true;
      setBlocked(true);
      return true;
    }

    if (probed && isElizonAppUrl(probed) && !tryResolveElizonAppRoute(probed)) {
      setBlocked(true);
      return true;
    }
    return false;
  }, [goToAppRouteFromUrl, useFallback]);

  useEffect(() => {
    handledRef.current = false;
    setBlocked(false);
    setActiveHostedFlowFallback(fallbackRoute ?? null);
    if (goToAppRouteFromUrl(url)) return;
    if (isElizonAppUrl(url) && !tryResolveElizonAppRoute(url)) {
      setBlocked(true);
    }
  }, [url, fallbackRoute, goToAppRouteFromUrl]);

  useEffect(() => {
    const onNativeUrl = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (detail?.url) goToAppRouteFromUrl(detail.url);
    };
    window.addEventListener("elizon:app-url", onNativeUrl);
    return () => window.removeEventListener("elizon:app-url", onNativeUrl);
  }, [goToAppRouteFromUrl]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      absorbIframeNavigation();
    }, 250);
    return () => window.clearInterval(poll);
  }, [url, absorbIframeNavigation]);

  const recoverFromBlocked = () => {
    if (absorbIframeNavigation()) return;
    if (useFallback()) return;
    const current = iframeRef.current?.src || url;
    if (goToAppRouteFromUrl(current)) return;
    if (isElizonAppUrl(current)) {
      window.location.assign(current);
      return;
    }
    navigate({ name: "dashboard" });
  };

  if (tryResolveElizonAppRoute(url)) {
    return null;
  }

  return (
    <div className="mx-auto flex h-full min-h-[70dvh] w-full max-w-screen flex-col lg:max-w-6xl">
      <div className="safe-x flex items-center gap-2 border-b border-(--border) py-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label={t("back")}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-(--text-primary)">{title ?? t("hostedFlowTitle")}</p>
        </div>
      </div>

      {blocked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-(--text-muted)">{t("hostedFlowBlocked")}</p>
          <Button onClick={recoverFromBlocked}>{t("back")}</Button>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          title={title ?? t("hostedFlowTitle")}
          src={url}
          className="min-h-0 flex-1 w-full border-0 bg-(--bg-base)"
          allow="camera; microphone; fullscreen; autoplay"
          allowFullScreen
          onError={() => {
            if (!absorbIframeNavigation() && !useFallback()) setBlocked(true);
          }}
          onLoad={() => {
            absorbIframeNavigation();
          }}
        />
      )}
    </div>
  );
}
