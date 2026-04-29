/**
 * Reusable customer-facing error display + global error boundary.
 * Shows a clear, friendly message with retry/alternative actions.
 */
import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, WifiOff, X } from "lucide-react";
import { ERRORS, type ErrorCode, logError } from "@/lib/errors";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface ErrorDisplayProps {
  code: ErrorCode;
  onRetry?: () => void;
  onDismiss?: () => void;
  context?: Record<string, unknown>;
}

export function ErrorDisplay({ code, onRetry, onDismiss, context }: ErrorDisplayProps) {
  const def = ERRORS[code];
  if (!def.customer) return null;
  const tone =
    def.severity === "critical" ? "border-destructive bg-destructive/5 text-destructive"
    : def.severity === "error" ? "border-destructive/40 bg-destructive/5"
    : def.severity === "warning" ? "border-amber-500/40 bg-amber-500/5"
    : "border-border bg-muted/40";

  return (
    <div className={`rounded-lg border p-4 ${tone}`} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2 text-sm">
          <p className="font-medium">{def.customer}</p>
          {context?.itemName ? (
            <p className="text-muted-foreground text-xs">المنتج: {String(context.itemName)}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> إغلاق
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">رمز الخطأ: {def.code}</p>
        </div>
      </div>
    </div>
  );
}

/** Floating offline banner — appears when navigator.onLine = false. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed bottom-4 inset-x-4 z-[100] mx-auto max-w-md rounded-lg border border-amber-500/50 bg-amber-500/10 backdrop-blur p-3 text-sm flex items-center gap-2 shadow-lg">
      <WifiOff className="h-4 w-4 text-amber-600" />
      <span>انقطع الاتصال — بياناتك محفوظة وسنكمل تلقائيًا عند عودة الإنترنت.</span>
    </div>
  );
}

/** Top-level error boundary catches unhandled UI errors. */
export class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError("SYSTEM_ERROR", {
      context: { message: error.message, stack: error.stack, componentStack: info.componentStack },
    });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorDisplay code="SYSTEM_ERROR" onRetry={() => { this.reset(); location.reload(); }} />
        </div>
      </div>
    );
  }
}
