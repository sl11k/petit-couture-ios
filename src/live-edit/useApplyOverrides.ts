import { useEffect, useState } from "react";
import { loadOverrides, resolveSelector, applyOverrideToEl } from "./overrides";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Applies published live overrides to the [data-live-root] element on this page.
 * Runs after mount and on language change. Re-runs after small delays to catch
 * async-rendered children (images, lazy lists).
 */
export function useApplyOverrides(
  pagePath: string,
  opts?: { includeDraft?: boolean; deps?: any[] },
) {
  const { lang } = useLanguage();
  const includeDraft = opts?.includeDraft ?? false;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let frame = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    (async () => {
      const overrides = await loadOverrides(pagePath, includeDraft);
      if (cancelled) return;
      const apply = () => {
        const root = document.querySelector("[data-live-root]");
        if (!root) return;
        // The inline editor owns draft rendering while it is active. Applying
        // published values here after a delay would overwrite what the admin
        // is currently typing.
        if (!includeDraft && root.getAttribute("data-live-editing") === "true") return;
        for (const o of overrides) {
          if (o.lang && o.lang !== "*" && o.lang !== lang && (o.prop === "text" || o.prop === "html")) continue;
          const el = resolveSelector(root, o.selector);
          if (el) applyOverrideToEl(el, o.prop, o.value);
        }
      };
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(apply);
      };
      apply();
      setReady(true);
      // Catch deferred mounts
      timers.push(setTimeout(apply, 300), setTimeout(apply, 1200));
      const root = document.querySelector("[data-live-root]");
      if (root) {
        observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, characterData: true, subtree: true });
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [pagePath, lang, includeDraft, ...(opts?.deps ?? [])]);

  return ready;
}
