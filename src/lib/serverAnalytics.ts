// Persistent analytics that writes to Supabase analytics_events table.
// Lightweight: fire-and-forget, never blocks UI.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "maisonnet:session_id:v1";
const VISITOR_KEY = "maisonnet:visitor_id:v1";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
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
    const { data: auth } = await supabase.auth.getUser();
    const enriched = {
      ...metadata,
      visitor_id: getVisitorId(),
      device: deviceType(),
      language: typeof navigator !== "undefined" ? navigator.language : null,
      screen_width: typeof screen !== "undefined" ? screen.width : null,
      screen_height: typeof screen !== "undefined" ? screen.height : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    await (supabase.from("analytics_events") as any).insert({
      session_id,
      user_id: auth.user?.id ?? null,
      event_name: eventName,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : null),
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      metadata: enriched,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    /* ignore */
  }
}

export function getCurrentSessionId(): string {
  return getSessionId();
}
