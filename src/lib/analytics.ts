// Lightweight, provider-agnostic analytics for wishlist interactions.
// No PII, no network calls — events are buffered in-memory (and mirrored to
// `window.__maisonnetEvents` for inspection) and dispatched as a CustomEvent
// so any host (GA, Segment, Plausible, server beacon) can listen and forward.

export type WishlistSource =
  | "home_header"
  | "home_card"
  | "category_card"
  | "product_detail"
  | "product_gallery"
  | "wishlist_screen"
  | "shared_link"
  | "hero"
  | "unknown";

export type WishlistItemKind = "product" | "category" | "campaign" | "unknown";

export type AnalyticsEvent =
  | {
      name: "wishlist_add";
      ts: number;
      itemId: string;
      itemKind: WishlistItemKind;
      itemSlug: string | null;
      source: WishlistSource;
      wishlistSize: number;
    }
  | {
      name: "wishlist_remove";
      ts: number;
      itemId: string;
      itemKind: WishlistItemKind;
      itemSlug: string | null;
      source: WishlistSource;
      wishlistSize: number;
    }
  | {
      name: "wishlist_clear";
      ts: number;
      previousSize: number;
      source: WishlistSource;
    }
  | {
      name: "wishlist_share";
      ts: number;
      scope: "item" | "all";
      itemCount: number;
      source: WishlistSource;
    }
  | {
      name: "wishlist_import";
      ts: number;
      requested: number;
      added: number;
      source: "shared_link";
    }
  | {
      name: "wishlist_undo";
      ts: number;
      previousSize: number;
      nextSize: number;
    };

const MAX_BUFFER = 200;
const buffer: AnalyticsEvent[] = [];

declare global {
  interface Window {
    __maisonnetEvents?: AnalyticsEvent[];
  }
}

// ─── Dev dispatch toggle ─────────────────────────────────────────────────────
// In development, allow disabling analytics dispatch so flows can be tested
// without polluting the buffer or notifying listeners. The setting is
// persisted in localStorage and ignored in production builds.
const TOGGLE_KEY = "maisonnet:analytics:enabled:v1";
const TOGGLE_EVENT = "maisonnet:analytics-toggle";

export function isAnalyticsEnabled(): boolean {
  if (!import.meta.env.DEV) return true;
  if (typeof localStorage === "undefined") return true;
  try {
    const raw = localStorage.getItem(TOGGLE_KEY);
    // Default ON unless explicitly disabled.
    return raw !== "false";
  } catch {
    return true;
  }
}

export function setAnalyticsEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TOGGLE_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent(TOGGLE_EVENT, { detail: { enabled } }),
      );
    } catch {
      /* ignore */
    }
  }
}

export const ANALYTICS_TOGGLE_EVENT = TOGGLE_EVENT;

export function classifyItem(id: string): {
  kind: WishlistItemKind;
  slug: string | null;
} {
  if (id.startsWith("product:")) return { kind: "product", slug: id.slice(8) || null };
  if (id.startsWith("category:")) return { kind: "category", slug: id.slice(9) || null };
  if (id.startsWith("hero:")) return { kind: "campaign", slug: id.slice(5) || null };
  return { kind: "unknown", slug: null };
}

export function trackEvent(event: AnalyticsEvent): void {
  if (!isAnalyticsEnabled()) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[analytics] suppressed (toggle off)", event.name);
    }
    return;
  }

  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  if (typeof window === "undefined") return;
  window.__maisonnetEvents = buffer;
  try {
    window.dispatchEvent(new CustomEvent("maisonnet:analytics", { detail: event }));
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event.name, event);
  }
}

export function getRecentEvents(): readonly AnalyticsEvent[] {
  return buffer;
}
