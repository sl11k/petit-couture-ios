import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { loadPixel, markPixelsReady, pixelPageView, type PixelRow } from "@/lib/pixels";

/**
 * Loads all enabled marketing pixels configured in the admin,
 * and fires a page view on every client-side route change.
 */
export function TrackingPixels() {
  const router = useRouter();
  const ready = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("tracking_pixels")
        .select("id,provider,label,pixel_id,custom_script,enabled,placement,sort_order")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      if (!active) return;
      ((data ?? []) as unknown as PixelRow[]).forEach(loadPixel);
      ready.current = true;
      markPixelsReady();
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let last = typeof window !== "undefined" ? window.location.pathname : "";
    const unsub = router.subscribe("onResolved", () => {
      const path = window.location.pathname;
      if (path === last) return;
      last = path;
      if (ready.current) pixelPageView();
    });
    return () => unsub();
  }, [router]);

  return null;
}
