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

export async function trackServerEvent(
  eventName: string,
  metadata: Record<string, unknown> = {},
  path?: string,
) {
  try {
    const session_id = getSessionId();
    const { data: auth } = await supabase.auth.getUser();
    await (supabase.from("analytics_events") as any).insert({
      session_id,
      user_id: auth.user?.id ?? null,
      event_name: eventName,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : null),
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      metadata,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    /* ignore */
  }
}

export function getCurrentSessionId(): string {
  return getSessionId();
}
