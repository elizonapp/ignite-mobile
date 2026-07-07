import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "../components/ui/button";
import { useRouter } from "../components/Router";
import { useI18n } from "../i18n";

export function HostedFlowScreen({ url, title }: { url: string; title?: string }) {
  const { t } = useI18n();
  const { back } = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(false);
  }, [url]);

  const continueInApp = () => {
    window.location.assign(url);
  };

  return (
    <div className="mx-auto flex h-full min-h-[70dvh] w-full max-w-screen flex-col lg:max-w-6xl">
      <div className="safe-x flex items-center gap-2 border-b border-(--border) py-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label={t("back")}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-(--text-primary)">{title ?? t("hostedFlowTitle")}</p>
          <p className="truncate text-xs text-(--text-muted)">{t("hostedFlowHint")}</p>
        </div>
      </div>

      {blocked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-(--text-muted)">{t("hostedFlowBlocked")}</p>
          <Button onClick={continueInApp}>{t("hostedFlowContinue")}</Button>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          title={title ?? t("hostedFlowTitle")}
          src={url}
          className="min-h-0 flex-1 w-full border-0 bg-(--bg-base)"
          onError={() => setBlocked(true)}
          onLoad={() => {
            try {
              const frame = iframeRef.current?.contentWindow;
              if (!frame) return;
              void frame.location.href;
            } catch {
              // Cross-origin — expected for payment providers.
            }
          }}
        />
      )}

      {!blocked && (
        <div className="safe-x border-t border-(--border) p-3">
          <button
            type="button"
            onClick={continueInApp}
            className="flex w-full items-center justify-center gap-2 py-2 text-xs text-(--text-muted) hover:text-(--text-secondary)"
          >
            <Loader2 className="size-3.5" />
            {t("hostedFlowContinue")}
          </button>
        </div>
      )}
    </div>
  );
}
