export const META_EVENT_MAP = {
  page_view: "PageView",
  view_content: "ViewContent",
  search: "Search",
  add_to_cart: "AddToCart",
  initiate_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  purchase: "Purchase",
} as const;

export type MetaStandardEvent = (typeof META_EVENT_MAP)[keyof typeof META_EVENT_MAP];

const STANDARD_EVENTS = new Set<MetaStandardEvent>(Object.values(META_EVENT_MAP));

export function toMetaEventName(name: string): MetaStandardEvent | null {
  if (STANDARD_EVENTS.has(name as MetaStandardEvent)) return name as MetaStandardEvent;
  return META_EVENT_MAP[name.toLowerCase() as keyof typeof META_EVENT_MAP] ?? null;
}

export function stableMetaEventId(event: MetaStandardEvent, logicalKey: string): string {
  const safe = logicalKey.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").slice(0, 80);
  return `lpp.${event}.${safe || "unknown"}`;
}

export function isIsoCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function shouldTransmitMeta(marketingConsent: boolean): boolean {
  return marketingConsent === true;
}
