import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useWishlist } from "@/state/WishlistContext";
import { categories, getProductForCategory } from "@/data/categories";

type BannerEvent = {
  id: string;
  kind: "added" | "removed";
  message: string;
  ts: number;
};

const VISIBLE_MS = 4000;
const FADE_MS = 220;

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
  const { items } = useWishlist();
  const { t, isRTL, dir } = useLanguage();
  const prevRef = useRef<string[] | null>(null);
  const [event, setEvent] = useState<BannerEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = items;
    // First mount: don't fire for hydration.
    if (prev === null) return;

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
    // Only update when wishlist state actually changes.
    if (!changedId || !kind) return;

    const name = resolveName(changedId, t.hero.eyebrow);
    const message = name
      ? kind === "added"
        ? t.wishlist.addedNamed(name)
        : t.wishlist.removedNamed(name)
      : kind === "added"
        ? t.wishlist.added
        : t.wishlist.removed;

    setEvent({ id: changedId, kind, message, ts: Date.now() });
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

  return (
    <div
      // Pinned just below the iOS status bar of the centered phone shell.
      className="pointer-events-none fixed inset-x-0 top-9 z-50 flex justify-center px-4"
      aria-live="polite"
      aria-atomic="true"
      dir={dir}
    >
      <div
        role="status"
        className={[
          "pointer-events-auto w-full max-w-[420px] rounded-full border border-gold-soft bg-background/95 backdrop-blur-md shadow-soft",
          "px-4 py-2.5 flex items-center gap-3",
          "transition-all duration-200 ease-out",
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2",
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
            "text-[12.5px] tracking-soft text-foreground truncate",
            isRTL ? "text-right" : "text-left",
            "flex-1",
          ].join(" ")}
        >
          {event.message}
        </p>
      </div>
    </div>
  );
}
