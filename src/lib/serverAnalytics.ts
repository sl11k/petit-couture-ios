// Persistent analytics that writes to Supabase analytics_events table.
// Lightweight: fire-and-forget, never blocks UI.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "maisonnet:session_id:v1";
const SESSION_ACTIVITY_KEY = "maisonnet:session_active:v1";
const VISITOR_KEY = "maisonnet:visitor_id:v1";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  const last = Number(window.sessionStorage.getItem(SESSION_ACTIVITY_KEY) || 0);
  if (!id || Date.now() - last > 30 * 60 * 1000) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  window.sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  return id;
}

function trim(value: string | null | undefined, max: number) {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

// ── Visit context (country / language / utm) ────────────────────────────────
// Captured once per session so every page view can be sliced by acquisition
// channel and geography without extra network calls per event.
const CTX_KEY = "maisonnet:visit_ctx:v1";

type VisitCtx = {
  country?: string | null;
  lang?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

let ctxPromise: Promise<VisitCtx> | null = null;

function readUtm(): VisitCtx {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const pick = (k: string) => trim(q.get(k), 60);
  const utm: VisitCtx = {
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    lang: trim(navigator?.language ?? null, 10),
  };
  return utm;
}

async function getVisitCtx(): Promise<VisitCtx> {
  if (typeof window === "undefined") return {};
  if (ctxPromise) return ctxPromise;
  ctxPromise = (async () => {
    let stored: VisitCtx = {};
    try {
      stored = JSON.parse(window.sessionStorage.getItem(CTX_KEY) || "{}");
    } catch {
      stored = {};
    }
    const fresh = readUtm();
    // UTM values only exist on the landing URL — keep the first ones seen.
    const merged: VisitCtx = {
      ...stored,
      lang: fresh.lang ?? stored.lang ?? null,
      utm_source: stored.utm_source ?? fresh.utm_source ?? null,
      utm_medium: stored.utm_medium ?? fresh.utm_medium ?? null,
      utm_campaign: stored.utm_campaign ?? fresh.utm_campaign ?? null,
    };
    if (!merged.country) {
      try {
        const r = await fetch("/api/public/geo", { headers: { accept: "application/json" } });
        if (r.ok) merged.country = (await r.json())?.country ?? null;
      } catch {
        /* ignore */
      }
    }
    try {
      window.sessionStorage.setItem(CTX_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
    return merged;
  })();
  return ctxPromise;
}

function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function deviceType() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

export async function trackServerEvent(
  eventName: string,
  metadata: Record<string, unknown> = {},
  path?: string,
) {
  try {
    const session_id = getSessionId();
    // getSession() reads the locally cached session — no network round-trip
    // per tracked event (getUser() hits the auth server every time).
    const { data: auth } = await supabase.auth.getSession();
    const ctx = await getVisitCtx();
    const rawPath = path ?? (typeof window !== "undefined" ? window.location.pathname : null);
    const enriched = {
      ...ctx,
      ...metadata,
      visitor_id: getVisitorId(),
      device: deviceType(),
      language: typeof navigator !== "undefined" ? navigator.language : null,
      screen_width: typeof screen !== "undefined" ? screen.width : null,
      screen_height: typeof screen !== "undefined" ? screen.height : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utm_source: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_source") : null,
      utm_medium: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_medium") : null,
      utm_campaign: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_campaign") : null,
      utm_content: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_content") : null,
      utm_term: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_term") : null,
    };
    await (supabase.from("analytics_events") as any).insert({
      session_id,
      user_id: auth.session?.user?.id ?? null,
      event_name: eventName,
      // Strip tracking query strings: they bloat storage and never get reported on.
      path: trim(rawPath ? rawPath.split("?")[0] : null, 200),
      referrer: trim(typeof document !== "undefined" ? document.referrer || null : null, 120),
      metadata: enriched,
      user_agent: trim(typeof navigator !== "undefined" ? navigator.userAgent : null, 120),
    });
  } catch {
    /* ignore */
  }
}


export function getCurrentSessionId(): string {
  return getSessionId();
}
