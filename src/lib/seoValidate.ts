/**
 * Lightweight JSON-LD validator (dev-only).
 * يتحقق من الحقول المطلوبة لكل @type يُستخدَم في المتجر:
 *   Product, CollectionPage, ItemList, ListItem, BreadcrumbList,
 *   Organization, WebSite, Offer, AggregateOffer, AggregateRating, Review.
 *
 * لا يحلّ محل https://validator.schema.org لكنه يلتقط أخطاء التركيب
 * الشائعة (حقل ناقص، نوع خاطئ، URL غير صالح، ترتيب ListItem) قبل النشر.
 */

type Issue = { level: "error" | "warn"; type: string; field: string; message: string };

const URL_RE = /^https?:\/\/[^\s]+$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const ALLOWED_AVAILABILITY = new Set([
  "https://schema.org/InStock",
  "https://schema.org/OutOfStock",
  "https://schema.org/PreOrder",
  "https://schema.org/Discontinued",
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isUrl(v: unknown): v is string {
  return typeof v === "string" && URL_RE.test(v);
}

function check(data: Record<string, unknown>, push: (i: Issue) => void) {
  const type = data["@type"];
  if (!type) {
    push({ level: "error", type: "?", field: "@type", message: "missing @type" });
    return;
  }
  const typeName = String(type);

  switch (typeName) {
    case "Product": {
      if (!isStr(data.name)) push({ level: "error", type: typeName, field: "name", message: "required string" });
      if (!isStr(data.description))
        push({ level: "warn", type: typeName, field: "description", message: "recommended" });
      const img = data.image;
      if (!img || (Array.isArray(img) && img.length === 0)) {
        push({ level: "error", type: typeName, field: "image", message: "required (string or array)" });
      } else if (Array.isArray(img)) {
        img.forEach((u, i) => !isUrl(u) && push({ level: "warn", type: typeName, field: `image[${i}]`, message: "should be absolute URL" }));
      } else if (!isUrl(img)) {
        push({ level: "warn", type: typeName, field: "image", message: "should be absolute URL" });
      }
      if (!isStr(data.sku)) push({ level: "warn", type: typeName, field: "sku", message: "recommended" });
      if (!data.brand) push({ level: "warn", type: typeName, field: "brand", message: "recommended" });
      if (data.offers) check(data.offers as Record<string, unknown>, push);
      if (data.aggregateRating) check(data.aggregateRating as Record<string, unknown>, push);
      if (Array.isArray(data.review)) data.review.forEach((r) => isObj(r) && check(r, push));
      break;
    }
    case "Offer": {
      if (!isStr(data.priceCurrency))
        push({ level: "error", type: typeName, field: "priceCurrency", message: "required ISO 4217" });
      if (data.price === undefined || data.price === null)
        push({ level: "error", type: typeName, field: "price", message: "required" });
      if (data.availability && !ALLOWED_AVAILABILITY.has(String(data.availability)))
        push({ level: "warn", type: typeName, field: "availability", message: "unknown availability URL" });
      if (data.url && !isUrl(data.url))
        push({ level: "warn", type: typeName, field: "url", message: "should be absolute URL" });
      if (data.priceValidUntil && !ISO_DATE_RE.test(String(data.priceValidUntil)))
        push({ level: "warn", type: typeName, field: "priceValidUntil", message: "expected ISO date" });
      break;
    }
    case "AggregateOffer": {
      if (!isStr(data.priceCurrency))
        push({ level: "error", type: typeName, field: "priceCurrency", message: "required" });
      if (data.lowPrice === undefined)
        push({ level: "error", type: typeName, field: "lowPrice", message: "required" });
      if (data.highPrice === undefined)
        push({ level: "error", type: typeName, field: "highPrice", message: "required" });
      if (typeof data.offerCount === "number" && data.offerCount < 1)
        push({ level: "warn", type: typeName, field: "offerCount", message: "should be >= 1" });
      break;
    }
    case "AggregateRating": {
      const v = Number(data.ratingValue);
      if (!isFinite(v) || v < 0 || v > 5)
        push({ level: "error", type: typeName, field: "ratingValue", message: "0–5 expected" });
      const c = Number(data.reviewCount ?? data.ratingCount);
      if (!isFinite(c) || c < 1)
        push({ level: "error", type: typeName, field: "reviewCount", message: "required >= 1" });
      break;
    }
    case "Review": {
      if (!data.author) push({ level: "warn", type: typeName, field: "author", message: "recommended" });
      if (!data.reviewRating) push({ level: "warn", type: typeName, field: "reviewRating", message: "recommended" });
      break;
    }
    case "BreadcrumbList": {
      const items = data.itemListElement;
      if (!Array.isArray(items) || items.length === 0) {
        push({ level: "error", type: typeName, field: "itemListElement", message: "required non-empty array" });
        break;
      }
      items.forEach((it, i) => {
        if (!isObj(it)) return;
        if (it.position !== i + 1)
          push({ level: "error", type: typeName, field: `itemListElement[${i}].position`, message: `expected ${i + 1}` });
        if (!isStr(it.name))
          push({ level: "warn", type: typeName, field: `itemListElement[${i}].name`, message: "missing name" });
        if (!isUrl(it.item))
          push({ level: "error", type: typeName, field: `itemListElement[${i}].item`, message: "must be absolute URL" });
      });
      break;
    }
    case "CollectionPage": {
      if (!isStr(data.name)) push({ level: "error", type: typeName, field: "name", message: "required" });
      if (!isUrl(data.url)) push({ level: "error", type: typeName, field: "url", message: "absolute URL required" });
      if (data.mainEntity) check(data.mainEntity as Record<string, unknown>, push);
      if (data.offers) check(data.offers as Record<string, unknown>, push);
      break;
    }
    case "ItemList": {
      const items = data.itemListElement;
      if (!Array.isArray(items) || items.length === 0) {
        push({ level: "error", type: typeName, field: "itemListElement", message: "required non-empty array" });
        break;
      }
      const seenPos = new Set<number>();
      const seenUrl = new Set<string>();
      items.forEach((it, i) => {
        if (!isObj(it)) return;
        const pos = Number(it.position);
        if (!isFinite(pos)) {
          push({ level: "error", type: typeName, field: `[${i}].position`, message: "required" });
        } else {
          if (seenPos.has(pos))
            push({ level: "error", type: typeName, field: `[${i}].position`, message: `duplicate ${pos}` });
          seenPos.add(pos);
        }
        const url = (it.url as string) || ((it.item as Record<string, unknown> | undefined)?.url as string);
        if (url) {
          if (!isUrl(url))
            push({ level: "warn", type: typeName, field: `[${i}].url`, message: "should be absolute" });
          if (seenUrl.has(url))
            push({ level: "warn", type: typeName, field: `[${i}].url`, message: "duplicate URL" });
          seenUrl.add(url);
        }
        if (isObj(it.item)) check(it.item, push);
      });
      // positions must form 1..N
      const sortedPos = [...seenPos].sort((a, b) => a - b);
      sortedPos.forEach((p, idx) => {
        if (p !== idx + 1)
          push({ level: "warn", type: typeName, field: "position-sequence", message: `expected 1..${sortedPos.length}, got ${sortedPos.join(",")}` });
      });
      break;
    }
    case "Organization":
    case "WebSite": {
      if (!isStr(data.name)) push({ level: "error", type: typeName, field: "name", message: "required" });
      if (!isUrl(data.url)) push({ level: "error", type: typeName, field: "url", message: "absolute URL required" });
      break;
    }
  }
}

export type ValidationResult = { ok: boolean; issues: Issue[] };

export function validateJsonLd(blocks: Array<Record<string, unknown>>): ValidationResult {
  const issues: Issue[] = [];
  blocks.forEach((b) => isObj(b) && check(b, (i) => issues.push(i)));
  return { ok: issues.filter((i) => i.level === "error").length === 0, issues };
}

/**
 * يُستدعى من useEffect داخل صفحات Landing/PDP في dev فقط.
 * يطبع جدولاً موجزًا في الكونسول إذا وُجدت مشاكل.
 */
export function devValidateJsonLd(label: string, blocks: Array<Record<string, unknown>>) {
  if (!import.meta.env?.DEV) return;
  if (!blocks?.length) return;
  const { ok, issues } = validateJsonLd(blocks);
  if (ok && issues.length === 0) {
    console.debug(`%c[seo:json-ld] ${label} ✓ ${blocks.length} block(s) valid`, "color:#16a34a");
    return;
  }
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  console.groupCollapsed(
    `%c[seo:json-ld] ${label} — ${errors.length} error(s), ${warns.length} warning(s)`,
    `color:${errors.length ? "#dc2626" : "#d97706"};font-weight:600`,
  );
  if (errors.length) console.table(errors);
  if (warns.length) console.table(warns);
  console.groupEnd();
}
