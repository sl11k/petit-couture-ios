/**
 * SEO helpers — موحّد للمتجر بأكمله.
 * - clean URLs (slugify)
 * - meta builders (title/description/OG/Twitter)
 * - canonical URL
 * - JSON-LD: Organization, Website, Product, Review, BreadcrumbList
 */

export const SITE = {
  name: "Maisonnét",
  url: "https://golden-boutique-ios.lovable.app",
  defaultImage:
    "https://golden-boutique-ios.lovable.app/og-default.jpg",
  locale: "ar_SA",
  twitter: "@maisonnet",
  themeColor: "#F8F5EF",
};

/** slugify يدعم العربية + اللاتينية، يولّد روابط نظيفة */
export function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonical(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  const clean = path === "/" ? "/" : path.replace(/\/+$/, "");
  return `${SITE.url}${clean}`;
}

export type MetaOptions = {
  title: string;
  description: string;
  image?: string;
  path: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  robots?: string;
  jsonLd?: Array<Record<string, unknown>>;
  locale?: string;
  alternateLocales?: Array<{ hreflang: string; path: string }>;
};

/** يحدّد ما إذا كان النص يحوي حرفًا عربيًا (RTL) */
function isRTLText(s: string): boolean {
  return /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(s);
}

/**
 * يضمن عرض العنوان/الوصف باتجاه صحيح حتى لو خُلط بأرقام أو كلمات لاتينية.
 * يضيف RLM (U+200F) في البداية للنص العربي، وLRM (U+200E) للنص اللاتيني،
 * مع First Strong Isolate (U+2068) + Pop Directional Isolate (U+2069)
 * لعزل المحتوى المختلط في معاينات Twitter/Facebook والمتصفحات.
 */
function withDirIsolate(text: string): string {
  if (!text) return text;
  const FSI = "\u2068";
  const PDI = "\u2069";
  const mark = isRTLText(text) ? "\u200F" : "\u200E";
  // إذا كان مغلّفًا مسبقًا لا نضاعف
  if (text.startsWith(FSI) || text.startsWith("\u200F") || text.startsWith("\u200E")) {
    return text;
  }
  return `${mark}${FSI}${text}${PDI}`;
}

/** قص آمن مع الحفاظ على محارف الاتجاه عند الحدود */
function safeTruncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function buildMeta(opts: MetaOptions) {
  const url = canonical(opts.path);
  const image = opts.image || SITE.defaultImage;
  const rawTitle = safeTruncate(opts.title, 60);
  const rawDescription = safeTruncate(opts.description, 160);
  const title = withDirIsolate(rawTitle);
  const description = withDirIsolate(rawDescription);
  const locale = opts.locale ?? SITE.locale;
  const lang = locale.split("_")[0] || "ar";
  const contentLanguage = locale.replace("_", "-");

  const robots =
    opts.robots ?? (opts.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { name: "robots", content: robots },
    { name: "theme-color", content: SITE.themeColor },
    { name: "language", content: lang },
    { httpEquiv: "content-language", content: contentLanguage },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: opts.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: rawTitle },
    { property: "og:site_name", content: SITE.name },
    { property: "og:locale", content: locale },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: SITE.twitter },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: rawTitle },
  ];

  // og:locale:alternate من alternateLocales (لو وُجد)
  if (opts.alternateLocales) {
    for (const alt of opts.alternateLocales) {
      const altLocale = alt.hreflang.replace("-", "_");
      meta.push({ property: "og:locale:alternate", content: altLocale });
    }
  }

  const links: Array<Record<string, string>> = [{ rel: "canonical", href: url }];

  if (opts.alternateLocales) {
    for (const alt of opts.alternateLocales) {
      links.push({ rel: "alternate", hrefLang: alt.hreflang, href: canonical(alt.path) });
    }
  }

  const scripts = (opts.jsonLd ?? []).map((data) => ({
    type: "application/ld+json",
    children: JSON.stringify(data),
  }));

  return { meta, links, scripts };
}


// ----------------------- JSON-LD builders -----------------------

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    sameAs: [
      "https://instagram.com/maisonnet",
      "https://twitter.com/maisonnet",
      "https://facebook.com/maisonnet",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        availableLanguage: ["Arabic", "English"],
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export type ProductSeoInput = {
  name: string;
  description: string;
  image: string | string[];
  sku: string;
  brand: string;
  price: number;
  currency: string;
  availability?: "in_stock" | "out_of_stock" | "discontinued" | "preorder";
  url: string;
  rating?: { value: number; count: number };
  reviews?: Array<{ author: string; rating: number; body: string; date?: string }>;
};

const AVAILABILITY_MAP: Record<string, string> = {
  in_stock: "https://schema.org/InStock",
  out_of_stock: "https://schema.org/OutOfStock",
  preorder: "https://schema.org/PreOrder",
  discontinued: "https://schema.org/Discontinued",
};

export function productJsonLd(p: ProductSeoInput) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.image,
    sku: p.sku,
    brand: { "@type": "Brand", name: p.brand },
    offers: {
      "@type": "Offer",
      url: p.url,
      priceCurrency: p.currency,
      price: p.price.toFixed(2),
      availability:
        AVAILABILITY_MAP[p.availability ?? "in_stock"] ?? AVAILABILITY_MAP.in_stock,
      priceValidUntil: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    },
  };
  if (p.rating && p.rating.count > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating.value.toFixed(1),
      reviewCount: p.rating.count,
    };
  }
  if (p.reviews?.length) {
    data.review = p.reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.body,
      datePublished: r.date,
    }));
  }
  return data;
}

/**
 * BreadcrumbList موحّد لكل الصفحات.
 * - يدعم مسارات نسبية (يُحوَّلها canonical) أو مطلقة.
 * - يطبّق withDirIsolate على الأسماء لضمان عرض RTL/LTR صحيح.
 * - inLanguage افتراضيًا ar-SA لمطابقة بقية الموقع.
 */
export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  opts?: { inLanguage?: string }
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    inLanguage: opts?.inLanguage ?? "ar-SA",
    itemListElement: items.map((it, i) => {
      const url = it.path.startsWith("http") ? it.path : canonical(it.path);
      return {
        "@type": "ListItem",
        position: i + 1,
        name: withDirIsolate(it.name),
        item: url,
      };
    }),
  };
}

export type CollectionItem = {
  name: string;
  url: string; // path or absolute
  image?: string;
  price?: number;
  currency?: string;
  brand?: string;
  sku?: string;
  availability?: "in_stock" | "out_of_stock" | "preorder" | "discontinued";
};

/** الحد الأقصى لعناصر ItemList — يوازن بين شمولية البيانات وحدود Google. */
export const COLLECTION_ITEM_LIMIT = 30;

/**
 * يبني CollectionPage + ItemList مع:
 * - إزالة العناصر المكرّرة (نفس url أو نفس name).
 * - ضمان أسماء فريدة (لاحقة #2, #3 عند التكرار النصي).
 * - ترتيب اختياري: "as-is" (الافتراضي) | "price-asc" | "price-desc" | "name".
 * - حد أقصى صريح (افتراضي 30، أقصى 100).
 * - itemListOrder (Ascending/Descending/Unordered) يُضاف للـ schema.
 */
export function collectionJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  items: CollectionItem[];
  image?: string;
  inLanguage?: string;
  isPartOf?: string;
  sort?: "as-is" | "price-asc" | "price-desc" | "name";
  limit?: number;
}) {
  const limit = Math.min(Math.max(opts.limit ?? COLLECTION_ITEM_LIMIT, 1), 100);

  // 1) Normalize + dedupe by canonical URL (fallback to name)
  const seenUrl = new Set<string>();
  const seenName = new Set<string>();
  const normalized = opts.items
    .filter((it) => it && it.name && it.url)
    .map((it) => {
      const itemUrl = it.url.startsWith("http") ? it.url : canonical(it.url);
      return { ...it, _url: itemUrl, _name: it.name.trim() };
    })
    .filter((it) => {
      const keyUrl = it._url.toLowerCase();
      if (seenUrl.has(keyUrl)) return false;
      seenUrl.add(keyUrl);
      return true;
    });

  // 2) Sort
  const sorted = [...normalized];
  switch (opts.sort) {
    case "price-asc":
      sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      break;
    case "price-desc":
      sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      break;
    case "name":
      sorted.sort((a, b) => a._name.localeCompare(b._name, "ar"));
      break;
  }

  // 3) Cap to limit
  const capped = sorted.slice(0, limit);

  // 4) Ensure unique display names (append " #N" for duplicates)
  const itemListElement = capped.map((it, i) => {
    let uniqueName = it._name;
    if (seenName.has(uniqueName.toLowerCase())) {
      let n = 2;
      while (seenName.has(`${it._name} #${n}`.toLowerCase())) n++;
      uniqueName = `${it._name} #${n}`;
    }
    seenName.add(uniqueName.toLowerCase());

    const product: Record<string, unknown> = {
      "@type": "Product",
      name: uniqueName,
      url: it._url,
    };
    if (it.image) product.image = it.image;
    if (it.brand) product.brand = { "@type": "Brand", name: it.brand };
    if (it.sku) product.sku = it.sku;
    if (typeof it.price === "number") {
      product.offers = {
        "@type": "Offer",
        url: it._url,
        priceCurrency: it.currency ?? "SAR",
        price: it.price.toFixed(2),
        availability:
          AVAILABILITY_MAP[it.availability ?? "in_stock"] ?? AVAILABILITY_MAP.in_stock,
      };
    }
    return {
      "@type": "ListItem",
      position: i + 1,
      name: uniqueName,
      url: it._url,
      item: product,
    };
  });

  // 5) Aggregate offer
  const prices = capped.map((i) => i.price).filter((p): p is number => typeof p === "number");
  const currency = capped.find((i) => i.currency)?.currency ?? "SAR";
  const aggregateOffer = prices.length
    ? {
        "@type": "AggregateOffer",
        priceCurrency: currency,
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: prices.length,
      }
    : undefined;

  const itemListOrder =
    opts.sort === "price-asc" || opts.sort === "name"
      ? "https://schema.org/ItemListOrderAscending"
      : opts.sort === "price-desc"
        ? "https://schema.org/ItemListOrderDescending"
        : "https://schema.org/ItemListUnordered";

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: opts.inLanguage ?? "ar-SA",
    isPartOf: { "@type": "WebSite", name: SITE.name, url: opts.isPartOf ?? SITE.url },
    mainEntity: {
      "@type": "ItemList",
      name: opts.name,
      numberOfItems: itemListElement.length,
      itemListOrder,
      itemListElement,
    },
  };
  if (opts.image) data.image = opts.image;
  if (aggregateOffer) data.offers = aggregateOffer;
  return data;
}
