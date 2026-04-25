import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  ANALYTICS_TOGGLE_EVENT,
  getRecentEvents,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  type AnalyticsEvent,
} from "@/lib/analytics";

export const Route = createFileRoute("/debug/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics debug — Maisonnét" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsDebug,
});

function formatTime(ts: number, locale: string): string {
  try {
    return new Date(ts).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

/** Compact one-line summary of the event-specific fields. */
function summarize(ev: AnalyticsEvent): string {
  switch (ev.name) {
    case "wishlist_add":
    case "wishlist_remove":
      return `${ev.itemKind}:${ev.itemSlug ?? "—"} · size=${ev.wishlistSize}`;
    case "wishlist_clear":
      return `prev=${ev.previousSize}`;
    case "wishlist_share":
      return `${ev.scope} · ${ev.itemCount} item${ev.itemCount === 1 ? "" : "s"}`;
    case "wishlist_import":
      return `requested=${ev.requested} · added=${ev.added}`;
    case "wishlist_undo":
      return `prev=${ev.previousSize} → next=${ev.nextSize}`;
  }
}

function eventSource(ev: AnalyticsEvent): string {
  return "source" in ev ? ev.source : "—";
}

const NAME_COLORS: Record<AnalyticsEvent["name"], string> = {
  wishlist_add: "bg-gold-soft text-gold-deep border-gold-soft",
  wishlist_remove: "bg-background text-muted-foreground border-border",
  wishlist_clear: "bg-background text-foreground/70 border-border",
  wishlist_share: "bg-cream-warm text-gold-deep border-gold-soft",
  wishlist_import: "bg-cream-warm text-gold-deep border-gold-soft",
  wishlist_undo: "bg-background text-foreground/70 border-border",
};

function AnalyticsDebug() {
  const router = useRouter();
  const { lang, isRTL } = useLanguage();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  // Snapshot + live updates. The buffer is shared by reference, so we copy
  // into local state on every dispatched event to trigger a re-render.
  const [events, setEvents] = useState<AnalyticsEvent[]>(() => [...getRecentEvents()]);

  useEffect(() => {
    const onEvt = () => setEvents([...getRecentEvents()]);
    window.addEventListener("maisonnet:analytics", onEvt);
    // Also resync on focus, in case events fired in another tab.
    window.addEventListener("focus", onEvt);
    return () => {
      window.removeEventListener("maisonnet:analytics", onEvt);
      window.removeEventListener("focus", onEvt);
    };
  }, []);

  // Dispatch toggle (dev only). Sync across tabs/components via the custom event.
  const isDev = import.meta.env.DEV;
  const [enabled, setEnabled] = useState<boolean>(() => isAnalyticsEnabled());
  useEffect(() => {
    const onToggle = () => setEnabled(isAnalyticsEnabled());
    window.addEventListener(ANALYTICS_TOGGLE_EVENT, onToggle);
    window.addEventListener("storage", onToggle);
    return () => {
      window.removeEventListener(ANALYTICS_TOGGLE_EVENT, onToggle);
      window.removeEventListener("storage", onToggle);
    };
  }, []);
  const toggle = () => {
    const next = !enabled;
    setAnalyticsEnabled(next);
    setEnabled(next);
  };

  // Newest first, capped to 50.
  const recent = events.slice(-50).reverse();

  const labels = {
    eyebrow: isRTL ? "تصحيح" : "DEBUG",
    title: isRTL ? "أحداث المفضلة" : "Wishlist analytics",
    subtitle: isRTL
      ? `آخر ${recent.length} حدث`
      : `Last ${recent.length} event${recent.length === 1 ? "" : "s"}`,
    empty: isRTL ? "لا توجد أحداث بعد" : "No events yet",
    emptyHint: isRTL
      ? "تفاعل مع المفضلة لرؤية الأحداث هنا في الوقت الفعلي."
      : "Interact with the wishlist — events stream here in real time.",
    back: isRTL ? "العودة" : "Back",
  };

  return (
    <div className="min-h-screen w-full bg-cream flex justify-center">
      <div className="relative w-full max-w-[440px] bg-background min-h-screen overflow-hidden shadow-soft">
        {/* iOS status bar */}
        <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold text-foreground tracking-tight">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-[2px] border border-foreground/80" />
            <span className="text-[11px]">100%</span>
          </div>
        </div>

        {/* Header */}
        <header className="px-5 pt-2 pb-3 flex items-center justify-between">
          <button
            aria-label={labels.back}
            onClick={() => router.history.back()}
            className="h-10 w-10 -ms-2 grid place-items-center rounded-full text-foreground/80 active:scale-95 transition"
          >
            <BackIcon className="h-[22px] w-[22px]" strokeWidth={1.6} />
          </button>
          <span className="text-[10.5px] tracking-luxury text-muted-foreground">
            {labels.eyebrow}
          </span>
          <span className="h-10 w-10" />
        </header>

        <main className="pb-12 px-5">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 grid place-items-center rounded-full bg-cream-warm border border-gold-soft text-gold-deep">
              <Activity className="h-[16px] w-[16px]" strokeWidth={1.6} />
            </span>
            <div className={isRTL ? "text-right" : "text-left"}>
              <h1 className="font-serif text-[24px] leading-tight text-foreground">
                {labels.title}
              </h1>
              <p className="text-[11px] tracking-luxury text-gold-deep mt-0.5 tabular-nums">
                {labels.subtitle}
              </p>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="mt-10 rounded-[20px] border border-dashed border-border bg-cream-warm/40 px-5 py-10 text-center">
              <p className="font-serif text-[18px] text-foreground">{labels.empty}</p>
              <p className="mt-2 text-[12.5px] text-muted-foreground tracking-soft">
                {labels.emptyHint}
              </p>
            </div>
          ) : (
            <ol className="mt-5 space-y-2">
              {recent.map((ev, idx) => (
                <li
                  key={`${ev.ts}-${idx}`}
                  className="rounded-[16px] border border-border bg-background px-3.5 py-2.5"
                  dir="ltr"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        "inline-flex items-center h-5 px-2 rounded-full border text-[10px] tracking-luxury",
                        NAME_COLORS[ev.name],
                      ].join(" ")}
                    >
                      {ev.name}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground tabular-nums">
                      {formatTime(ev.ts, locale)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-foreground/80 break-words font-mono">
                    {summarize(ev)}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    source · <span className="text-foreground/70">{eventSource(ev)}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-8 text-center">
            <Link to="/" className="text-[12px] tracking-luxury text-gold-deep">
              {isRTL ? "العودة إلى المتجر" : "BACK TO BOUTIQUE"}
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
