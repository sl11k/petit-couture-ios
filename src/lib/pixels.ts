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

/** Fires a page view on all loaded pixels (used on client-side route changes). */
export function pixelPageView(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  try { w.ttq?.page?.(); } catch { /* noop */ }
  try { w.fbq?.("track", "PageView"); } catch { /* noop */ }
  try { w.snaptr?.("track", "PAGE_VIEW"); } catch { /* noop */ }
  try { w.pintrk?.("page"); } catch { /* noop */ }
}
