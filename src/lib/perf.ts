import { supabase } from "@/integrations/supabase/client";

// ===== Performance budgets (single source of truth) =====
export const PERF_BUDGETS = {
  LCP_MS: 2500,        // Largest Contentful Paint  — "good" threshold
  INP_MS: 200,         // Interaction to Next Paint
  CLS: 0.1,            // Cumulative Layout Shift
  TTFB_MS: 800,        // Time to First Byte
  FCP_MS: 1800,        // First Contentful Paint
  ROUTE_CHANGE_MS: 500,
  ADMIN_TABLE_LOAD_MS: 1500,   // 50 rows query
  PRODUCT_PAGE_LOAD_MS: 2000,
  CHECKOUT_STEP_MS: 1500,
  SEARCH_AUTOCOMPLETE_MS: 250,
  API_P95_MS: 800,
};

function rate(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  switch (metric) {
    case "LCP": return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "INP": return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    case "CLS": return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "TTFB": return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
    case "FCP": return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
    default: return "good";
  }
}

let _session: string | null = null;
function sessionId() {
  if (_session) return _session;
  if (typeof window === "undefined") return null;
  _session = sessionStorage.getItem("_perf_sid");
  if (!_session) {
    _session = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_perf_sid", _session);
  }
  return _session;
}

function deviceType(): "mobile" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

function connectionType(): string | null {
  if (typeof navigator === "undefined") return null;
  const c = (navigator as any).connection;
  return c?.effectiveType ?? null;
}

// Buffer + flush so we don't spam the network
const buffer: any[] = [];
let flushTimer: any = null;

async function flush() {
  flushTimer = null;
  if (!buffer.length) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    await (supabase as any).from("perf_metrics").insert(batch);
  } catch {/* non-fatal */}
}

export function recordMetric(metric: string, value: number, page?: string) {
  if (typeof window === "undefined") return;
  buffer.push({
    metric,
    value: Number(value.toFixed(3)),
    rating: rate(metric, value),
    page: page ?? window.location.pathname,
    navigation_type: (performance.getEntriesByType("navigation")[0] as any)?.type ?? null,
    device: deviceType(),
    connection: connectionType(),
    session_id: sessionId(),
  });
  if (!flushTimer) flushTimer = setTimeout(flush, 4000);
}

// ===== Web Vitals collection (no extra deps) =====
export function startWebVitals() {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

  // LCP
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      const last = entries[entries.length - 1];
      if (last) recordMetric("LCP", last.renderTime || last.loadTime || last.startTime);
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {/* ignore */}

  // CLS
  try {
    let cls = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
    });
    po.observe({ type: "layout-shift", buffered: true });
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") recordMetric("CLS", cls);
    });
  } catch {/* ignore */}

  // INP (approx via event timing)
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.duration > 40) recordMetric("INP", entry.duration);
      }
    });
    po.observe({ type: "event", buffered: true, durationThreshold: 40 } as any);
  } catch {/* ignore */}

  // FCP + TTFB from navigation
  try {
    const nav = performance.getEntriesByType("navigation")[0] as any;
    if (nav) recordMetric("TTFB", nav.responseStart);
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    if (fcp) recordMetric("FCP", fcp.startTime);
  } catch {/* ignore */}

  // Long tasks (jank in admin tables)
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.duration > 100) recordMetric("LongTask", entry.duration);
      }
    });
    po.observe({ type: "longtask", buffered: true });
  } catch {/* ignore */}

  addEventListener("beforeunload", flush);
}

// ===== Helper: time a code block =====
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  try { return await fn(); }
  finally { recordMetric(label, performance.now() - t); }
}
