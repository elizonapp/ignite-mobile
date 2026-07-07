import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from '../lib/utils';

type ToastTone = "info" | "success" | "warning" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    setToasts((current) => [...current, { id: nextId++, message, tone }]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const next = toasts[0];
    if (!next) return;
    const handle = window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== next.id));
    }, 2800);
    return () => window.clearTimeout(handle);
  }, [toasts]);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 safe-top"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const tone: Record<ToastTone, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "text-(--elizon-primary) bg-(--elizon-primary)/12" },
  success: { icon: CheckCircle2, cls: "text-(--success) bg-(--success)/12" },
  warning: { icon: AlertTriangle, cls: "text-(--warning) bg-(--warning)/12" },
  error: { icon: AlertTriangle, cls: "text-(--error) bg-(--error)/12" },
};

function ToastItem({ toast }: { toast: Toast }) {
  const meta = tone[toast.tone];
  const Icon = meta.icon;
  return (
    <div className="glass pointer-events-auto flex w-full max-w-sm items-center gap-3 px-3 py-2 text-sm shadow-lg">
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", meta.cls)}>
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-(--text-primary)">{toast.message}</span>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
