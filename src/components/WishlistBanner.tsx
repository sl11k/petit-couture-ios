import { useEffect, useRef, useState } from "react";
import { Heart, RotateCcw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { categories, getProductForCategory } from "@/data/categories";

type BannerEvent = {
  id: string;
  kind: "added" | "removed";
  message: string;
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

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = items;

    // First mount: don't fire for hydration.
    if (prev === null) return;

    // Suppress the diff caused by an Undo revert.
    const currentSig = items.join("|");
    if (skipNextSignatureRef.current === currentSig) {
      skipNextSignatureRef.current = null;
      // Also clear any visible event since we just reverted it.
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

    const name = resolveName(changedId, t.hero.eyebrow);
    const message = name
      ? kind === "added"
        ? t.wishlist.addedNamed(name)
        : t.wishlist.removedNamed(name)
      : kind === "added"
        ? t.wishlist.added
        : t.wishlist.removed;

    setEvent({ id: changedId, kind, message, prevItems: prev, ts: Date.now() });
    setVisible(true);

    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (removeTimer.current) window.clearTimeout(removeTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    removeTimer.current = window.setTimeout(
      () => setEvent(null),
      VISIBLE_MS + FADE_MS,
    );
  }, [items, t.wishlist, t.hero.eyebrow]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (removeTimer.current) window.clearTimeout(removeTimer.current);
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
          "pointer-events-auto w-full max-w-[420px] rounded-full border border-gold-soft bg-background/95 backdrop-blur-md shadow-soft",
          "px-4 py-2 flex items-center gap-3",
          "transition-all duration-200 ease-out",
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        ].join(" ")}
      >
        <span
          className={[
            "h-7 w-7 grid place-items-center rounded-full shrink-0",
            event.kind === "added"
              ? "bg-gold-deep/10 text-gold-deep"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          <Heart
            className="h-[14px] w-[14px]"
            strokeWidth={1.7}
            fill={event.kind === "added" ? "currentColor" : "none"}
          />
        </span>
        <p
          className={[
            "text-[12.5px] tracking-soft text-foreground truncate flex-1",
            isRTL ? "text-right" : "text-left",
          ].join(" ")}
        >
          {event.message}
        </p>
        <button
          type="button"
          onClick={onUndo}
          aria-label={t.wishlist.undo}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 -me-1 rounded-full bg-foreground text-background text-[11.5px] tracking-luxury active:scale-95 transition"
        >
          <RotateCcw className="h-[12px] w-[12px]" strokeWidth={2} />
          {isRTL ? t.wishlist.undo : t.wishlist.undo.toUpperCase()}
        </button>
      </div>
    </div>
  );
}
