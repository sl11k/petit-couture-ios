// Persistent analytics that writes to Supabase analytics_events table.
// Lightweight: fire-and-forget, never blocks UI.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "maisonnet:session_id:v1";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
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
    await (supabase.from("analytics_events") as any).insert({
      session_id,
      user_id: auth.session?.user?.id ?? null,
      event_name: eventName,
      // Strip tracking query strings: they bloat storage and never get reported on.
      path: trim(rawPath ? rawPath.split("?")[0] : null, 200),
      referrer: trim(typeof document !== "undefined" ? document.referrer || null : null, 120),
      metadata: { ...ctx, ...metadata },
      user_agent: trim(typeof navigator !== "undefined" ? navigator.userAgent : null, 120),
    });
  } catch {
    /* ignore */
  }
}


export function getCurrentSessionId(): string {
  return getSessionId();
}
