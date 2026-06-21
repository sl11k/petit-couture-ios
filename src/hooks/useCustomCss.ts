import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cached: string | null = null;
const subscribers = new Set<(v: string) => void>();

export function setCustomCssLive(css: string) {
  cached = css;
  subscribers.forEach((fn) => fn(css));
}

/**
 * Loads `site_settings.custom_css` and injects it as a <style> tag.
 * Admins editing the CSS from the live editor can call setCustomCssLive
 * to apply changes instantly without a reload.
 */
export function useCustomCss() {
  const [css, setCss] = useState<string>(cached ?? "");
  useEffect(() => {
    if (cached === null) {
      supabase.from("site_settings").select("custom_css").limit(1).maybeSingle()
        .then(({ data }) => {
          const v = (data as any)?.custom_css ?? "";
          cached = v;
          setCss(v);
        });
    }
    const fn = (v: string) => setCss(v);
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById("lpp-custom-css") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "lpp-custom-css";
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [css]);

  return css;
}
