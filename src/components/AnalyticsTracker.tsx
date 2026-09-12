import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { trackServerEvent } from "@/lib/serverAnalytics";

/**
 * Tracks page views automatically on every route change.
 * Mounted once at the root.
 */
export function AnalyticsTracker() {
  const router = useRouter();
  const lastPath = useRef<string | null>(null);
  const enteredAt = useRef(Date.now());

  useEffect(() => {
    const fire = () => {
      const path = window.location.pathname + window.location.search;
      if (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/debug")) return;
      if (lastPath.current === path) return;
      if (lastPath.current) {
        void trackServerEvent("page_exit", {
          duration_ms: Math.max(0, Date.now() - enteredAt.current),
        }, lastPath.current);
      }
      lastPath.current = path;
      enteredAt.current = Date.now();
      void trackServerEvent("page_view", { title: document.title }, path);
    };
    fire();
    const unsub = router.subscribe("onResolved", fire);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible" && lastPath.current) {
        void trackServerEvent("session_heartbeat", {
          duration_ms: Math.max(0, Date.now() - enteredAt.current),
        }, lastPath.current);
      }
    }, 30000);
    const visibility = () => {
      if (document.visibilityState === "hidden" && lastPath.current) {
        void trackServerEvent("page_exit", {
          duration_ms: Math.max(0, Date.now() - enteredAt.current),
        }, lastPath.current);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      unsub();
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [router]);

  return null;
}
