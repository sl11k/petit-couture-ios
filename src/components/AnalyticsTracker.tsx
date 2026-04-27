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

  useEffect(() => {
    const fire = () => {
      const path = window.location.pathname + window.location.search;
      if (lastPath.current === path) return;
      lastPath.current = path;
      void trackServerEvent("page_view", { title: document.title }, path);
    };
    fire();
    const unsub = router.subscribe("onResolved", fire);
    return () => unsub();
  }, [router]);

  return null;
}
