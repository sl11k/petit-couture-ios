import { useEffect, useRef, useState } from "react";
import { Heart, RotateCcw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { categories, getProductForCategory } from "@/data/categories";

type BannerEvent = {
  id: string;
  kind: "added" | "removed";
  /** Localized eyebrow label, e.g. "Added to wishlist". */
  label: string;
  /** Optional resolved item name to render in serif italic. */
  itemName: string | null;
  /** Snapshot of items right BEFORE this change — used by Undo to revert. */
  prevItems: string[];
  ts: number;
};

const VISIBLE_MS = 4000;
const FADE_MS = 220;
/** Coalesce rapid taps on the same item within this window. */
const DEBOUNCE_MS = 350;

function resolveName(id: string, heroLabel: string): string | null {
  if (id.startsWith("product:") || id.startsWith("category:")) {
    const slug = id.split(":")[1];
    const cat = categories.find((c) => c.slug === slug);
    if (!cat) return null;
    return getProductForCategory(slug).name;
  }
  if (id.startsWith("hero:")) return heroLabel;
  return null;
}

export function WishlistBanner() {
  const { items, restore } = useWishlist();
  const { t, isRTL } = useLanguage();

  const prevRef = useRef<string[] | null>(null);
  // When set, the next items diff is treated as a silent revert (no banner).
  const skipNextSignatureRef = useRef<string | null>(null);

  const [event, setEvent] = useState<BannerEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);

  // Per-item debounce state. For each id currently being rapidly toggled we
  // remember whether it was present BEFORE the burst started, the snapshot of
  // the entire wishlist at that moment (for Undo), and the pending timer.
  const debounceRef = useRef<
    Map<
      string,
      {
        baselinePresent: boolean;
        baselineItems: string[];
        timer: number;
      }
    >
  >(new Map());

  const showBanner = (
    changedId: string,
    kind: "added" | "removed",
    prevItems: string[],
  ) => {
    const itemName = resolveName(changedId, t.hero.eyebrow);
    const label = kind === "added" ? t.wishlist.added : t.wishlist.removed;

    setEvent({ id: changedId, kind, label, itemName, prevItems, ts: Date.now() });
    setVisible(true);

    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (removeTimer.current) window.clearTimeout(removeTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    removeTimer.current = window.setTimeout(
      () => setEvent(null),
      VISIBLE_MS + FADE_MS,
    );
  };

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = items;

    // First mount: don't fire for hydration.
    if (prev === null) return;

    // Suppress the diff caused by an Undo revert.
    const currentSig = items.join("|");
    if (skipNextSignatureRef.current === currentSig) {
      skipNextSignatureRef.current = null;
      // Cancel any pending debounced banners — Undo wipes the slate.
      for (const entry of debounceRef.current.values()) {
        window.clearTimeout(entry.timer);
      }
      debounceRef.current.clear();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (removeTimer.current) window.clearTimeout(removeTimer.current);
      setVisible(false);
      removeTimer.current = window.setTimeout(() => setEvent(null), FADE_MS);
      return;
    }

    const prevSet = new Set(prev);
    const currSet = new Set(items);
    let changedId: string | null = null;
    let kind: "added" | "removed" | null = null;
    for (const id of items) {
      if (!prevSet.has(id)) {
        changedId = id;
        kind = "added";
        break;
      }
    }
    if (!changedId) {
      for (const id of prev) {
        if (!currSet.has(id)) {
          changedId = id;
          kind = "removed";
          break;
        }
      }
    }
    if (!changedId || !kind) return;

    const id = changedId;
    const nowPresent = currSet.has(id);
    const existing = debounceRef.current.get(id);

    // No active burst yet — start one. Capture the baseline so we can decide
    // whether the net change is meaningful when the timer fires.
    if (!existing) {
      const timer = window.setTimeout(() => {
        const entry = debounceRef.current.get(id);
        debounceRef.current.delete(id);
        if (!entry) return;
        const finalPresent = prevRef.current?.includes(id) ?? false;
        // Net no-op (tapped back to baseline) — suppress the banner entirely.
        if (finalPresent === entry.baselinePresent) return;
        showBanner(
          id,
          finalPresent ? "added" : "removed",
          entry.baselineItems,
        );
      }, DEBOUNCE_MS);
      debounceRef.current.set(id, {
        baselinePresent: !nowPresent, // state before this first flip
        baselineItems: prev,
        timer,
      });
      return;
    }

    // Already in a burst — extend the window. Baseline stays pinned to the
    // very first pre-burst state so a final no-op is detectable.
    window.clearTimeout(existing.timer);
    existing.timer = window.setTimeout(() => {
      const entry = debounceRef.current.get(id);
      debounceRef.current.delete(id);
      if (!entry) return;
      const finalPresent = prevRef.current?.includes(id) ?? false;
      if (finalPresent === entry.baselinePresent) return;
      showBanner(
        id,
        finalPresent ? "added" : "removed",
        entry.baselineItems,
      );
    }, DEBOUNCE_MS);
  }, [items, t.wishlist, t.hero.eyebrow]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (removeTimer.current) window.clearTimeout(removeTimer.current);
      for (const entry of debounceRef.current.values()) {
        window.clearTimeout(entry.timer);
      }
      debounceRef.current.clear();
    };
  }, []);

  if (!event) return null;

  const onUndo = () => {
    // Mark the upcoming items diff (which will match prevItems exactly) as silent
    // so the banner doesn't echo an opposite "Removed/Added" event.
    skipNextSignatureRef.current = event.prevItems.join("|");
    restore(event.prevItems);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-9 z-50 flex justify-center px-4"
      aria-live="polite"
      aria-atomic="true"
      dir={t.dir}
    >
      <div
        role="status"
        className={[
          "pointer-events-auto w-full max-w-[420px]",
          "rounded-full border border-gold-soft bg-cream/95 backdrop-blur-md shadow-soft",
          "ps-2 pe-2 py-1.5 flex items-center gap-3",
          "transition-all duration-300 ease-out",
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        ].join(" ")}
      >
        <span
          className={[
            "h-8 w-8 grid place-items-center rounded-full shrink-0 border",
            event.kind === "added"
              ? "bg-gold-soft border-gold-soft text-gold-deep"
              : "bg-background border-border text-muted-foreground",
          ].join(" ")}
        >
          <Heart
            className="h-[14px] w-[14px]"
            strokeWidth={1.6}
            fill={event.kind === "added" ? "currentColor" : "none"}
          />
        </span>
        <div
          className={[
            "min-w-0 flex-1 leading-tight",
            isRTL ? "text-right" : "text-left",
          ].join(" ")}
        >
          <p className="text-[9.5px] tracking-luxury text-gold-deep uppercase truncate">
            {isRTL ? event.label : event.label.toUpperCase()}
          </p>
          {event.itemName && (
            <p className="font-serif italic text-[14px] text-foreground truncate -mt-px">
              {event.itemName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onUndo}
          aria-label={t.wishlist.undo}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-gold-deep text-background text-[10.5px] tracking-luxury active:scale-95 transition shadow-gold/40"
        >
          <RotateCcw className="h-[11px] w-[11px]" strokeWidth={1.8} />
          {isRTL ? t.wishlist.undo : t.wishlist.undo.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
