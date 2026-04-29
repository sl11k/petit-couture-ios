import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  RefreshCw,
  SearchX,
  WifiOff,
} from "lucide-react";

/**
 * StateViews — مكتبة موحدة لحالات الشاشات
 * تدعم: Default / Loading / Empty / Error / Success / Disabled / Hover / Active
 *        Mobile / RTL / Long Text / كثيرة جدًا / قليلة جدًا
 *
 * المبدأ: كل شاشة تستخدم <StateBoundary state={...}> لتغليف محتواها،
 * فيُعرض الـ skeleton/empty/error تلقائيًا حسب الحالة.
 */

export type ViewState =
  | "default"
  | "loading"
  | "empty"
  | "error"
  | "success"
  | "disabled";

// -------------------- Loading --------------------
export function LoadingState({
  rows = 6,
  variant = "list",
  className,
}: {
  rows?: number;
  variant?: "list" | "grid" | "card" | "table" | "page";
  className?: string;
}) {
  if (variant === "grid") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3",
          className,
        )}
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[3/4] w-full rounded-lg" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div
        className={cn("space-y-2", className)}
        role="status"
        aria-busy="true"
      >
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (variant === "card") {
    return (
      <div
        className={cn("rounded-lg border p-4 space-y-3", className)}
        role="status"
        aria-busy="true"
      >
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (variant === "page") {
    return (
      <div
        className={cn(
          "min-h-[60vh] grid place-items-center",
          className,
        )}
        role="status"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">جاري التحميل…</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

// -------------------- Empty --------------------
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-16",
        "px-4 gap-3",
        className,
      )}
      role="status"
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground max-w-md break-words">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md break-words">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline" className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// خاص بالبحث بدون نتائج
export function NoSearchResults({
  query,
  onClear,
}: {
  query?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title={query ? `لا توجد نتائج لـ "${query}"` : "لا توجد نتائج"}
      description="جرّب كلمات أخرى أو تحقق من الإملاء، أو أزل بعض الفلاتر."
      action={onClear ? { label: "مسح الفلاتر", onClick: onClear } : undefined}
    />
  );
}

// -------------------- Error --------------------
export function ErrorState({
  title = "حدث خطأ غير متوقع",
  description = "تعذّر تحميل البيانات. يمكنك المحاولة مرة أخرى.",
  onRetry,
  technicalDetails,
  className,
  variant = "block",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  technicalDetails?: string;
  className?: string;
  variant?: "block" | "inline" | "page";
}) {
  if (variant === "inline") {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2">
          <span className="break-words">{description}</span>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-3 w-3 me-1" />
              إعادة
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3",
        variant === "page" ? "min-h-[60vh]" : "py-16",
        "px-4",
        className,
      )}
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-base font-medium max-w-md break-words">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md break-words">
        {description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-2">
          <RefreshCw className="h-4 w-4 me-2" />
          إعادة المحاولة
        </Button>
      )}
      {technicalDetails && (
        <details className="mt-3 text-xs text-muted-foreground max-w-md">
          <summary className="cursor-pointer">تفاصيل تقنية</summary>
          <pre className="mt-2 text-start whitespace-pre-wrap break-all bg-muted p-2 rounded">
            {technicalDetails}
          </pre>
        </details>
      )}
    </div>
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="لا يوجد اتصال بالإنترنت"
      description="تحقق من اتصالك ثم أعد المحاولة. لن تُفقد بياناتك."
      onRetry={onRetry}
    />
  );
}

// -------------------- Success --------------------
export function SuccessState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4 gap-3",
        className,
      )}
      role="status"
    >
      <div className="rounded-full bg-success/15 p-4">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <h3 className="text-base font-medium max-w-md break-words">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md break-words">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// -------------------- Truncation helpers --------------------
/** نص طويل: قص مع tooltip بصري عبر title */
export function Truncate({
  children,
  lines = 1,
  className,
}: {
  children: React.ReactNode;
  lines?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const text = typeof children === "string" ? children : undefined;
  const clampClass =
    lines === 1
      ? "truncate"
      : lines === 2
        ? "line-clamp-2"
        : lines === 3
          ? "line-clamp-3"
          : "line-clamp-4";
  return (
    <span
      className={cn("block break-words", clampClass, className)}
      title={text}
    >
      {children}
    </span>
  );
}

// -------------------- StateBoundary --------------------
/**
 * يغلف محتوى الشاشة ويعرض الحالة المناسبة تلقائيًا.
 *
 * <StateBoundary
 *   loading={isLoading}
 *   error={error}
 *   isEmpty={items.length === 0}
 *   onRetry={refetch}
 *   loadingVariant="grid"
 *   emptyTitle="لا توجد عناصر"
 * >
 *   {children}
 * </StateBoundary>
 */
export function StateBoundary({
  loading,
  error,
  isEmpty,
  onRetry,
  children,
  loadingVariant = "list",
  loadingRows,
  emptyIcon,
  emptyTitle = "لا توجد بيانات",
  emptyDescription,
  emptyAction,
  errorTitle,
  errorDescription,
}: {
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingVariant?: "list" | "grid" | "card" | "table" | "page";
  loadingRows?: number;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  errorTitle?: string;
  errorDescription?: string;
}) {
  if (loading) {
    return <LoadingState variant={loadingVariant} rows={loadingRows} />;
  }
  if (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : undefined;
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription || msg}
        onRetry={onRetry}
        technicalDetails={msg}
      />
    );
  }
  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return <>{children}</>;
}

// -------------------- Connectivity hook --------------------
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function ConnectivityBadge() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-4 py-2 text-xs shadow-lg">
        <WifiOff className="h-3.5 w-3.5" />
        <span>أنت غير متصل بالإنترنت</span>
      </div>
    </div>
  );
}
