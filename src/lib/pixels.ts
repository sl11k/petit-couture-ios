// Marketing pixels: provider catalog + script loaders.
// Pixels are configured from the admin (table: tracking_pixels) and injected
// on the storefront only (never inside /admin).

export type PixelProvider =
  | "tiktok"
  | "meta"
  | "instagram"
  | "snapchat"
  | "google_analytics"
  | "google_ads"
  | "google_tag_manager"
  | "pinterest"
  | "twitter"
  | "linkedin"
  | "custom";

export type PixelRow = {
  id: string;
  provider: PixelProvider | string;
  label: string | null;
  pixel_id: string | null;
  custom_script: string | null;
  enabled: boolean;
  placement: string;
  sort_order: number;
};

export const PIXEL_PROVIDERS: {
  value: PixelProvider;
  label: { ar: string; en: string };
  idLabel: { ar: string; en: string };
  idPlaceholder: string;
  needsId: boolean;
}[] = [
  {
    value: "tiktok",
    label: { ar: "تيك توك", en: "TikTok" },
    idLabel: { ar: "معرّف البكسل (Pixel ID)", en: "Pixel ID" },
    idPlaceholder: "D9JMJRJC77U1QT0MFB50",
    needsId: true,
  },
  {
    value: "meta",
    label: { ar: "ميتا / فيسبوك", en: "Meta (Facebook)" },
    idLabel: { ar: "معرّف البكسل", en: "Pixel ID" },
    idPlaceholder: "1234567890",
    needsId: true,
  },
  {
    value: "instagram",
    label: { ar: "إنستجرام (عبر ميتا)", en: "Instagram (via Meta)" },
    idLabel: { ar: "معرّف بكسل ميتا", en: "Meta Pixel ID" },
    idPlaceholder: "1234567890",
    needsId: true,
  },
  {
    value: "snapchat",
    label: { ar: "سناب شات", en: "Snapchat" },
    idLabel: { ar: "معرّف البكسل", en: "Pixel ID" },
    idPlaceholder: "00000000-0000-0000-0000-000000000000",
    needsId: true,
  },
  {
    value: "google_analytics",
    label: { ar: "جوجل أناليتكس (GA4)", en: "Google Analytics (GA4)" },
    idLabel: { ar: "معرّف القياس", en: "Measurement ID" },
    idPlaceholder: "G-XXXXXXXXXX",
    needsId: true,
  },
  {
    value: "google_ads",
    label: { ar: "إعلانات جوجل", en: "Google Ads" },
    idLabel: { ar: "معرّف التحويل", en: "Conversion ID" },
    idPlaceholder: "AW-XXXXXXXXX",
    needsId: true,
  },
  {
    value: "google_tag_manager",
    label: { ar: "Google Tag Manager", en: "Google Tag Manager" },
    idLabel: { ar: "معرّف الحاوية", en: "Container ID" },
    idPlaceholder: "GTM-XXXXXXX",
    needsId: true,
  },
  {
    value: "pinterest",
    label: { ar: "بنترست", en: "Pinterest" },
    idLabel: { ar: "معرّف العلامة", en: "Tag ID" },
    idPlaceholder: "2612345678901",
    needsId: true,
  },
  {
    value: "twitter",
    label: { ar: "إكس (تويتر)", en: "X (Twitter)" },
    idLabel: { ar: "معرّف البكسل", en: "Pixel ID" },
    idPlaceholder: "oXXXX",
    needsId: true,
  },
  {
    value: "linkedin",
    label: { ar: "لينكدإن", en: "LinkedIn" },
    idLabel: { ar: "معرّف الشريك", en: "Partner ID" },
    idPlaceholder: "1234567",
    needsId: true,
  },
  {
    value: "custom",
    label: { ar: "كود مخصص", en: "Custom script" },
    idLabel: { ar: "معرّف (اختياري)", en: "Identifier (optional)" },
    idPlaceholder: "",
    needsId: false,
  },
];

export function providerLabel(provider: string, ar: boolean): string {
  const p = PIXEL_PROVIDERS.find((x) => x.value === provider);
  if (!p) return provider;
  return ar ? p.label.ar : p.label.en;
}

declare global {
  interface Window {
    ttq?: any;
    fbq?: any;
    snaptr?: any;
    gtag?: any;
    dataLayer?: any[];
    pintrk?: any;
    twq?: any;
    lintrk?: any;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
  }
}

const loaded = new Set<string>();

function injectScript(src: string, attrs: Record<string, string> = {}) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.appendChild(s);
}

function loadTikTok(id: string) {
  const w = window as any;
  w.TiktokAnalyticsObject = "ttq";
  const ttq = (w.ttq = w.ttq || []);
  ttq.methods = [
    "page","track","identify","instances","debug","on","off","once","ready","alias",
    "group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent",
  ];
  ttq.setAndDefer = function (t: any, e: string) {
    t[e] = function () {
      t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
  ttq.instance = function (t: string) {
    const e = ttq._i[t] || [];
    for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
    return e;
  };
  ttq.load = function (e: string, n?: any) {
    const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[e] = [];
    ttq._i[e]._u = r;
    ttq._t = ttq._t || {};
    ttq._t[e] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[e] = n || {};
    injectScript(`${r}?sdkid=${e}&lib=ttq`);
  };
  ttq.load(id);
  ttq.page();
}

function loadMeta(id: string) {
  const w = window as any;
  if (!w.fbq) {
    const n: any = (w.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    injectScript("https://connect.facebook.net/en_US/fbevents.js");
  }
  w.fbq("init", id);
  w.fbq("track", "PageView");
}

function loadSnap(id: string) {
  const w = window as any;
  if (!w.snaptr) {
    const a: any = (w.snaptr = function () {
      a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments);
    });
    a.queue = [];
    injectScript("https://sc-static.net/scevent.min.js");
  }
  w.snaptr("init", id);
  w.snaptr("track", "PAGE_VIEW");
}

function loadGtag(id: string) {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) {
    w.gtag = function () {
      w.dataLayer.push(arguments);
    };
    w.gtag("js", new Date());
  }
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  w.gtag("config", id);
}

function loadGtm(id: string) {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": +new Date(), event: "gtm.js" });
  injectScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
}

function loadPinterest(id: string) {
  const w = window as any;
  if (!w.pintrk) {
    const p: any = (w.pintrk = function () {
      p.queue.push(Array.prototype.slice.call(arguments));
    });
    p.queue = [];
    p.version = "3.0";
    injectScript("https://s.pinimg.com/ct/core.js");
  }
  w.pintrk("load", id);
  w.pintrk("page");
}

function loadTwitter(id: string) {
  const w = window as any;
  if (!w.twq) {
    const t: any = (w.twq = function () {
      t.exe ? t.exe.apply(t, arguments) : t.queue.push(arguments);
    });
    t.version = "1.1";
    t.queue = [];
    injectScript("https://static.ads-twitter.com/uwt.js");
  }
  w.twq("config", id);
}

function loadLinkedIn(id: string) {
  const w = window as any;
  w._linkedin_partner_id = id;
  w._linkedin_data_partner_ids = w._linkedin_data_partner_ids || [];
  w._linkedin_data_partner_ids.push(id);
  if (!w.lintrk) {
    w.lintrk = function (a: any, b: any) {
      (w.lintrk.q = w.lintrk.q || []).push([a, b]);
    };
    w.lintrk.q = [];
    injectScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
  }
}

function loadCustom(rowId: string, script: string) {
  const container = document.createElement("div");
  container.innerHTML = script;
  const nodes = Array.from(container.querySelectorAll("script"));
  if (nodes.length === 0) {
    // plain JS without <script> wrapper
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.text = script;
    s.setAttribute("data-pixel", rowId);
    document.head.appendChild(s);
    return;
  }
  nodes.forEach((node) => {
    const s = document.createElement("script");
    Array.from(node.attributes).forEach((a) => s.setAttribute(a.name, a.value));
    if (node.src) s.async = true;
    else s.text = node.textContent ?? "";
    s.setAttribute("data-pixel", rowId);
    document.head.appendChild(s);
  });
  // Append non-script markup (e.g. noscript pixels)
  Array.from(container.childNodes).forEach((n) => {
    if ((n as HTMLElement).tagName?.toLowerCase() === "script") return;
    document.body.appendChild(n);
  });
}

/** Loads one configured pixel. Safe to call repeatedly — each row loads once. */
export function loadPixel(row: PixelRow): void {
  if (typeof window === "undefined") return;
  if (!row.enabled) return;
  if (loaded.has(row.id)) return;
  const id = (row.pixel_id ?? "").trim();
  try {
    switch (row.provider) {
      case "tiktok":
        if (id) loadTikTok(id);
        break;
      case "meta":
      case "instagram":
        if (id) loadMeta(id);
        break;
      case "snapchat":
        if (id) loadSnap(id);
        break;
      case "google_analytics":
      case "google_ads":
        if (id) loadGtag(id);
        break;
      case "google_tag_manager":
        if (id) loadGtm(id);
        break;
      case "pinterest":
        if (id) loadPinterest(id);
        break;
      case "twitter":
        if (id) loadTwitter(id);
        break;
      case "linkedin":
        if (id) loadLinkedIn(id);
        break;
      case "custom":
        if (row.custom_script) loadCustom(row.id, row.custom_script);
        break;
      default:
        if (row.custom_script) loadCustom(row.id, row.custom_script);
    }
    loaded.add(row.id);
  } catch {
    /* never break the storefront because of a pixel */
  }
}

// ── Event buffering ───────────────────────────────────────────────
// Pixel rows are fetched from the database, so scripts load a moment after
// hydration. Events fired before that (ViewContent / InitiateCheckout on a
// hard load) would otherwise be silently dropped. Buffer and flush them.
let pixelsReady = false;
const pending: { event: PixelEventName; payload: PixelEventPayload }[] = [];
const recentEvents = new Map<string, number>();

export function markPixelsReady(): void {
  pixelsReady = true;
  const queued = pending.splice(0, pending.length);
  queued.forEach(({ event, payload }) => dispatchPixelEvent(event, payload));
}

export function pixelPageView(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  try { w.ttq?.page?.(); } catch { /* noop */ }
  try { w.fbq?.("track", "PageView"); } catch { /* noop */ }
  try { w.snaptr?.("track", "PAGE_VIEW"); } catch { /* noop */ }
  try { w.pintrk?.("page"); } catch { /* noop */ }
}

export type PixelEventName =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Search";

export interface PixelEventPayload {
  content_name?: string;
  content_id?: string;
  content_type?: string;
  value?: number;
  currency?: string;
  quantity?: number;
  order_id?: string;
  contents?: { id: string; quantity: number; price?: number }[];
  search_string?: string;
}

/** Fires a specific ecommerce event to all configured pixels. */
export function pixelTrack(event: PixelEventName, payload: PixelEventPayload = {}): void {
  if (typeof window === "undefined") return;
  // Drop accidental duplicates (re-renders, StrictMode double-effects):
  // same event + same content within 2s is the same user action.
  const dedupeKey = `${event}|${payload.content_id ?? ""}|${payload.order_id ?? ""}|${payload.value ?? ""}|${payload.quantity ?? ""}|${payload.search_string ?? ""}`;
  const now = Date.now();
  const seenAt = recentEvents.get(dedupeKey);
  if (seenAt && now - seenAt < 2000) return;
  recentEvents.set(dedupeKey, now);

  if (!pixelsReady) {
    if (pending.length < 50) pending.push({ event, payload });
    return;
  }
  dispatchPixelEvent(event, payload);
}

function dispatchPixelEvent(event: PixelEventName, payload: PixelEventPayload): void {
  const w = window as any;
  // Debug trail: inspect with window.__pixelEvents in the browser console.
  (w.__pixelEvents = w.__pixelEvents || []).push({ t: Date.now(), event, payload });

  // Common mapping for currency / value. The value is always whatever the
  // caller measured for this specific event; if items are itemised we prefer
  // their sum so the reported value can never drift from the line items.
  const currency = payload.currency || "SAR";
  const itemsSum = (payload.contents ?? []).reduce(
    (sum, c) => sum + (Number(c.price) || 0) * (Number(c.quantity) || 1),
    0,
  );
  const explicit = Number(payload.value);
  const value = Number.isFinite(explicit) && explicit > 0 ? explicit : itemsSum;


  // 1. TikTok
  try {
    if (w.ttq && w.ttq.track) {
      if (event === "Search") {
        w.ttq.track("Search", { query: payload.search_string });
      } else {
        const ttEvent: string = event === "Purchase" ? "CompletePayment" : event === "AddPaymentInfo" ? "AddPaymentInfo" : event;
        const ttPayload: any = {
        content_name: payload.content_name,
        content_id: payload.content_id,
        content_type: payload.content_type || "product",
        value: value,
        currency: currency,
        quantity: payload.quantity || 1,
      };

      if (payload.contents && payload.contents.length > 0) {
        ttPayload.contents = payload.contents.map(c => ({
          content_id: c.id,
          content_type: "product",
          quantity: c.quantity,
          price: c.price
        }));
      }

        w.ttq.track(ttEvent, ttPayload);
      }
    }
  } catch { /* noop */ }

  // 2. Meta / Facebook — browser pixel + Conversions API with a shared
  //    event_id so Meta deduplicates the pair instead of double-counting.
  const metaEventId = `${event.toLowerCase()}.${payload.order_id || payload.content_id || "x"}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    if (w.fbq) {
      if (event === "Search") {
        w.fbq("track", "Search", { search_string: payload.search_string }, { eventID: metaEventId });
      } else {
        const fbPayload: any = {
          content_name: payload.content_name,
          content_type: payload.content_type || "product",
          value: value,
          currency: currency,
        };
      
      if (payload.contents && payload.contents.length > 0) {
        fbPayload.contents = payload.contents.map(c => ({
          id: c.id,
          quantity: c.quantity,
          item_price: c.price
        }));
        fbPayload.content_ids = payload.contents.map(c => c.id);
        fbPayload.num_items = payload.contents.reduce((sum, c) => sum + (c.quantity || 1), 0);
      } else if (payload.content_id) {
        fbPayload.content_ids = [payload.content_id];
        fbPayload.num_items = payload.quantity || 1;
      }
      
        w.fbq("track", event, fbPayload, { eventID: metaEventId });
      }
    }
  } catch { /* noop */ }

  // 2b. Server-side mirror (survives ad-blockers, ITP and payment redirects).
  void mirrorToMetaCapi(event, payload, metaEventId, currency, value);


  // 3. Snapchat
  try {
    if (w.snaptr) {
      if (event === "Search") {
        w.snaptr("track", "SEARCH", { search_string: payload.search_string });
      } else {
        const snapMap: Record<PixelEventName, string> = {
          ViewContent: "VIEW_CONTENT",
          AddToCart: "ADD_CART",
          InitiateCheckout: "START_CHECKOUT",
          AddPaymentInfo: "ADD_BILLING",
          Purchase: "PURCHASE",
          Search: "SEARCH" // To satisfy type but handled above
        };
        const snapEvent: string = snapMap[event] ?? event;

        const snapPayload: any = {
        price: value,
        currency: currency,
        transaction_id: payload.order_id,
      };

      if (payload.contents && payload.contents.length > 0) {
        snapPayload.item_ids = payload.contents.map(c => c.id);
        snapPayload.number_items = payload.contents.reduce((sum, c) => sum + (c.quantity || 1), 0);
      } else if (payload.content_id) {
        snapPayload.item_ids = [payload.content_id];
        snapPayload.item_category = payload.content_name;
      }

        w.snaptr("track", snapEvent, snapPayload);
      }
    }
  } catch { /* noop */ }
}

// ── Meta Conversions API bridge ───────────────────────────────────
// Identity the shopper typed in checkout (hashed server-side, never stored raw
// anywhere else) so Meta can attribute conversions even without cookies.
const PIXEL_USER_KEY = "lpp:pixel_user:v1";

export function setPixelUser(user: { email?: string | null; phone?: string | null; city?: string | null; country?: string | null }): void {
  if (typeof window === "undefined") return;
  try {
    const prev = readPixelUser();
    const next = { ...prev, ...Object.fromEntries(Object.entries(user).filter(([, v]) => !!v)) };
    window.localStorage.setItem(PIXEL_USER_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

function readPixelUser(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PIXEL_USER_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Stable anonymous visitor id, hashed server-side into Meta's `external_id`.
 * Guarantees every CAPI event carries at least one user_data key even when the
 * shopper has not typed an email/phone yet (ViewContent, AddToCart, ...).
 */
const VISITOR_ID_KEY = "lpp:visitor_id:v1";

function visitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Meta's browser pixel writes `_fbp`, but ad-blockers often stop it. Writing a
 * spec-compliant fallback keeps server events attributable.
 */
function ensureFbp(): string | null {
  if (typeof document === "undefined") return null;
  const existing = readCookie("_fbp");
  if (existing) return existing;
  try {
    const value = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`;
    document.cookie = `_fbp=${value}; path=/; max-age=${90 * 86400}; SameSite=Lax`;
    return value;
  } catch {
    return null;
  }
}

/** Captures fbclid from the landing URL into an _fbc cookie (Meta expects this). */
export function captureMetaClickId(): void {
  if (typeof window === "undefined") return;
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (!fbclid || readCookie("_fbc")) return;
    const value = `fb.1.${Date.now()}.${fbclid}`;
    document.cookie = `_fbc=${encodeURIComponent(value)}; path=/; max-age=${90 * 86400}; SameSite=Lax`;
  } catch { /* noop */ }
}

function mirrorToMetaCapi(
  event: PixelEventName,
  payload: PixelEventPayload,
  eventId: string,
  currency: string,
  value: number,
): void {
  if (typeof window === "undefined") return;
  const user = readPixelUser();
  void import("@/lib/meta-capi.functions")
    .then(({ trackMetaConversion }) =>
      trackMetaConversion({
        data: {
          event_name: event,
          event_id: eventId,
          event_source_url: window.location.href.slice(0, 500),
          value,
          currency,
          content_name: payload.content_name ?? null,
          content_type: payload.content_type ?? null,
          order_id: payload.order_id ?? null,
          search_string: payload.search_string ?? null,
          num_items: payload.quantity ?? null,
          contents:
            payload.contents && payload.contents.length > 0
              ? payload.contents
              : payload.content_id
                ? [{ id: payload.content_id, quantity: payload.quantity || 1, price: payload.value }]
                : undefined,
          user: {
            email: user.email ?? null,
            phone: user.phone ?? null,
            city: user.city ?? null,
            country: user.country ?? null,
            external_id: user.external_id ?? visitorId(),
            fbp: ensureFbp(),
            fbc: readCookie("_fbc"),
          },
        },
      }),
    )
    .catch(() => { /* never break the storefront */ });
}
