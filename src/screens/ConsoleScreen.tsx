import { resolveApiError } from "../api/resolve-error";
import { resolveCaughtApiError } from "../api/resolve-caught-error";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clipboard, Image, Keyboard, Loader2, Trash2 } from "lucide-react";

import { useRouter } from '../components/Router';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { getApiBaseUrl } from '../lib/config';
import { cn } from '../lib/utils';

type ConsoleData = {
  type: "vnc" | "terminal" | "web";
  url?: string;
  wsPath?: string;
  commandUrl?: string;
  streamUrl?: string;
  ticket?: string;
  vncPassword?: string;
  expiresAt?: string;
};

type ConsoleResponse = {
  success: boolean;
  console?: ConsoleData;
  error?: string;
};

// ── VNC console (Proxmox) ────────────────────────────────────────────────────

function VncConsole({ wsPath, password, onError }: { wsPath: string; password?: string; onError: (e: string) => void }) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    let mounted = true;
    setConnecting(true);

    const connect = async () => {
      if (!containerRef.current) return;
      if (!password) {
        onError(t("vncAuthMissing"));
        setConnecting(false);
        return;
      }
      try {
        const { default: RFB } = await import("novnc-next");
        if (!mounted || !containerRef.current) return;

        const base = getApiBaseUrl();
        const wsBase = base.replace(/^http/, "ws");
        const wsUrl = `${wsBase}${wsPath}`;

        const rfb = new RFB(containerRef.current, wsUrl, { credentials: { password } });
        rfb.scaleViewport = true;
        rfb.resizeSession = true;
        rfb.qualityLevel = 6;
        rfb.compressionLevel = 2;

        rfb.addEventListener("connect", () => {
          if (!mounted) return;
          setConnected(true);
          setConnecting(false);
        });
        rfb.addEventListener("disconnect", (e: any) => {
          if (!mounted) return;
          setConnected(false);
          setConnecting(false);
          if (e.detail?.clean === false) onError(t("vncConnectionLost"));
        });
        rfb.addEventListener("credentialsrequired", () => {
          rfb.sendCredentials({ password: password || "" });
        });

        rfbRef.current = rfb;
      } catch (err) {
        if (!mounted) return;
        const msg = resolveCaughtApiError(err, t, "consoleVncLoadError");
        onError(msg);
        setConnecting(false);
      }
    };

    connect();
    return () => {
      mounted = false;
      try { rfbRef.current?.disconnect(); } catch { /* ignore */ }
      rfbRef.current = null;
    };
  }, [wsPath, password]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      try {
        rfbRef.current?._display?.autoscale(
          containerRef.current!.clientWidth,
          containerRef.current!.clientHeight,
        );
      } catch { /* ignore */ }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const sendCtrlAltDel = () => {
    try { rfbRef.current?.sendCtrlAltDel(); } catch { /* ignore */ }
  };

  const pasteToVm = () => {
    if (!pasteText || !rfbRef.current) return;
    try { rfbRef.current.clipboardPasteFrom(pasteText); } catch { /* ignore */ }
    setPasteOpen(false);
    setPasteText("");
  };

  const takeScreenshot = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
    const a = document.createElement("a");
    a.download = "console-screenshot.png";
    a.href = url;
    a.click();
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Control bar */}
      <div className="flex items-center justify-between gap-2 border-b border-(--border) bg-black/70 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--success) opacity-40" />}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", connected ? "bg-(--success)" : connecting ? "bg-(--warning)" : "bg-(--error)")} />
          </span>
          <span className="text-[10px] text-(--text-muted)">
            {connecting ? t("consoleConnecting") : connected ? t("consoleConnected") : t("consoleDisconnected")}
          </span>
        </div>
        {connected && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={sendCtrlAltDel}
              className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-(--text-muted) hover:bg-white/10 hover:text-white"
            >
              Ctrl+Alt+Del
            </button>
            <button type="button" onClick={() => setPasteOpen((v) => !v)}
              className="rounded-md p-1 text-(--text-muted) hover:bg-white/10 hover:text-white" title={t("paste")}
            >
              <Clipboard className="size-3.5" />
            </button>
            <button type="button" onClick={takeScreenshot}
              className="rounded-md p-1 text-(--text-muted) hover:bg-white/10 hover:text-white" title={t("screenshot")}
            >
              <Image className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Clipboard paste panel */}
      {pasteOpen && (
        <div className="border-b border-(--border) bg-[#111] px-3 py-2 flex gap-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t("consolePastePlaceholder")}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-(--border) bg-black px-2 py-1 font-mono text-xs text-white placeholder:text-[#555] focus:outline-none"
          />
          <div className="flex flex-col gap-1">
            <button type="button" onClick={pasteToVm}
              className="rounded-lg bg-(--elizon-primary)/20 px-2 py-1 text-[10px] font-medium text-(--elizon-primary)"
            >
              {t("paste")}
            </button>
            <button type="button" onClick={() => { setPasteOpen(false); setPasteText(""); }}
              className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-(--text-muted)"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* VNC canvas */}
      {connecting && !connected && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-(--elizon-primary)" />
            <span className="text-sm text-(--text-muted)">{t("consoleConnecting")}</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 bg-black" style={{ touchAction: "none" }} />
    </div>
  );
}

// ── Terminal console (Pterodactyl / SSE) ────────────────────────────────────

type ConsoleLine = { text: string; isError?: boolean; isSystem?: boolean };

function TerminalConsole({ consoleData }: { consoleData: ConsoleData }) {
  const { t } = useI18n();
  const outputRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);

  const appendLine = useCallback((text: string, opts: { isError?: boolean; isSystem?: boolean } = {}) => {
    setLines((prev) => [...prev.slice(-500), { text, ...opts }]);
  }, []);

  useEffect(() => {
    if (!consoleData.streamUrl) {
      setIsConnected(true);
      return;
    }
    const base = getApiBaseUrl();
    const url = consoleData.streamUrl.startsWith("http") ? consoleData.streamUrl : `${base}${consoleData.streamUrl}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => { setIsConnected(true); appendLine(t("consoleConnected"), { isSystem: true }); });
    es.addEventListener("auth_success", () => appendLine(t("consoleAuthenticated"), { isSystem: true }));
    es.addEventListener("console_output", (ev: MessageEvent) => {
      try { const d = JSON.parse(ev.data as string) as { output?: string }; if (d.output) appendLine(d.output); } catch { /* ignore */ }
    });
    es.addEventListener("daemon_error", (ev: MessageEvent) => appendLine(ev.data as string, { isError: true }));
    es.addEventListener("disconnected", () => {
      setIsConnected(false);
      appendLine(t("consoleDisconnected"), { isSystem: true });
      es.close();
    });
    es.onerror = () => {
      setIsConnected(false);
      appendLine(t("consoleConnectionError"), { isError: true });
    };
    return () => { es.close(); };
  }, [consoleData.streamUrl, t, appendLine]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  const sendCommand = async () => {
    if (!input.trim() || !consoleData.commandUrl) return;
    const cmd = input.trim();
    appendLine(`$ ${cmd}`);
    setCommandHistory((h) => [cmd, ...h.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput("");
    try {
      const base = getApiBaseUrl();
      const url = consoleData.commandUrl.startsWith("http") ? consoleData.commandUrl : `${base}${consoleData.commandUrl}`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
        credentials: "omit",
      });
    } catch {
      appendLine(t("consoleSendCommandFailed"), { isError: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void sendCommand();
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, commandHistory.length - 1);
      setHistoryIdx(next);
      setInput(commandHistory[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? "" : commandHistory[next] ?? "");
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-2 border-b border-(--border) bg-black/70 px-3 py-1.5">
        <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-(--success)" : "bg-(--error)")} />
        <span className="text-[10px] text-(--text-muted)">
          {isConnected ? t("consoleConnected") : t("consoleConnecting")}
        </span>
        <button type="button" onClick={() => setLines([])} className="ml-auto rounded p-0.5 text-(--text-muted) hover:text-white">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div ref={outputRef} className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0a] px-3 py-2 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={cn(
            "whitespace-pre-wrap break-all",
            line.isError && "text-(--error)",
            line.isSystem && "italic text-(--text-muted)",
            !line.isError && !line.isSystem && "text-[#c8c8c8]",
          )}>{line.text}</div>
        ))}
      </div>
      {consoleData.commandUrl && (
        <div className="flex items-center gap-2 border-t border-(--border) bg-[#0a0a0a] px-3 py-2">
          <span className="font-mono text-xs text-(--elizon-primary)">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("consoleInputPlaceholder")}
            disabled={!isConnected}
            className="flex-1 bg-transparent font-mono text-xs text-[#c8c8c8] placeholder:text-[#555] focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}

// ── Main ConsoleScreen ────────────────────────────────────────────────────────

export function ConsoleScreen({ id }: { id: string }) {
  const { t } = useI18n();
  const { back } = useRouter();

  const [consoleData, setConsoleData] = useState<ConsoleData | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const data = await api.get<ConsoleResponse>(`/api/services/${id}/console`);
      if (!data.success || !data.console) {
        setError(resolveApiError(data, t, { fallbackKey: "unknownError" }));
        return;
      }
      setConsoleData(data.console);
    } catch (err) {
      setError(resolveCaughtApiError(err, t));
    } finally {
      setIsConnecting(false);
    }
  }, [id, t]);

  useEffect(() => { void connect(); }, [connect]);

  return (
    <div className="mx-auto flex h-full min-h-screen w-full max-w-3xl flex-1 flex-col relative">
      <div className="safe-x safe-top flex items-center gap-3 border-b border-(--border) px-4 py-3">
        <button type="button" onClick={back}
          className="rounded-lg p-1.5 text-(--text-secondary) hover:bg-(--bg-elevated)"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold text-(--text-primary)">{t("consoleTitle")}</h1>
        {consoleData?.expiresAt && (
          <span className="text-[10px] text-(--text-muted)">
            exp {new Date(consoleData.expiresAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {isConnecting ? (
        <div className="flex flex-1 items-center justify-center gap-3">
          <Loader2 className="size-5 animate-spin text-(--text-muted)" />
          <span className="text-sm text-(--text-muted)">{t("consoleConnecting")}</span>
        </div>
      ) : error ? (
        <div className="safe-x p-4">
          <div className="glass border border-(--error)/30 p-4 text-sm text-(--error)">
            {error}
            <button type="button" onClick={() => void connect()}
              className="ml-3 text-xs font-medium text-(--elizon-primary) hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        </div>
      ) : consoleData?.type === "vnc" ? (
        consoleData.wsPath ? (
          <VncConsole
            wsPath={consoleData.wsPath}
            password={consoleData.vncPassword}
            onError={setError}
          />
        ) : (
          <div className="safe-x p-4 text-sm text-(--text-muted)">{t("consoleNotAvailable")}</div>
        )
      ) : consoleData?.type === "web" ? (
        consoleData.url ? (
          <div className="flex-1 min-h-0">
            <iframe
              src={consoleData.url}
              title={t("consoleTitle")}
              className="h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="safe-x p-4 text-sm text-(--text-muted)">{t("consoleNotAvailable")}</div>
        )
      ) : consoleData ? (
        <TerminalConsole consoleData={consoleData} />
      ) : null}
    </div>
  );
}
