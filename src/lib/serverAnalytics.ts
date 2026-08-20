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
    const rawPath = path ?? (typeof window !== "undefined" ? window.location.pathname : null);
    await (supabase.from("analytics_events") as any).insert({
      session_id,
      user_id: auth.session?.user?.id ?? null,
      event_name: eventName,
      // Strip tracking query strings: they bloat storage and never get reported on.
      path: trim(rawPath ? rawPath.split("?")[0] : null, 200),
      referrer: trim(typeof document !== "undefined" ? document.referrer || null : null, 120),
      metadata,
      user_agent: trim(typeof navigator !== "undefined" ? navigator.userAgent : null, 120),
    });
  } catch {
    /* ignore */
  }
}

export function getCurrentSessionId(): string {
  return getSessionId();
}
