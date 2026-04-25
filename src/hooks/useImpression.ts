import { useEffect, useRef } from "react";
import { classifyItem, trackEvent, type WishlistSource } from "@/lib/analytics";

/**
 * Per-session set of (source, itemId) pairs that have already been counted as
 * impressions. Mounted/unmounted cards do not re-fire, scrolling away and back
 * does not re-fire, and route-revisits within the session do not re-fire.
 * This keeps "impressions" comparable to "saves" without inflation.
 */
const seen = new Set<string>();

type Options = {
  /** Stable wishlist item id, e.g. "product:dresses" or "category:tops". */
  itemId: string;
  /** Where on the app the impression originated. */
  source: WishlistSource;
  /** Min visible ratio to count as seen. Default 0.5. */
  threshold?: number;
  /** Min continuous time on screen (ms) before firing. Default 400. */
  dwellMs?: number;
};

/**
 * Attach the returned ref to the card element. The first time it has been
 * continuously visible for `dwellMs` at >= `threshold`, a `wishlist_impression`
 * event is dispatched once per session for that (source, itemId) pair.
 */
export function useImpression<T extends HTMLElement>({
  itemId,
  source,
  threshold = 0.5,
  dwellMs = 400,
}: Options) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;

    const key = `${source}::${itemId}`;
    if (seen.has(key)) return;

    let dwellTimer: number | null = null;

    const fire = () => {
      if (seen.has(key)) return;
      seen.add(key);
      const { kind, slug } = classifyItem(itemId);
      trackEvent({
        name: "wishlist_impression",
        ts: Date.now(),
        itemId,
        itemKind: kind,
        itemSlug: slug,
        source,
      });
      observer.disconnect();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            if (dwellTimer === null) {
              dwellTimer = window.setTimeout(fire, dwellMs);
            }
          } else if (dwellTimer !== null) {
            window.clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        }
      },
      { threshold: [0, threshold, 1] },
    );

    observer.observe(node);
    return () => {
      if (dwellTimer !== null) window.clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [itemId, source, threshold, dwellMs]);

  return ref;
}
