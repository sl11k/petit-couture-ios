# SEO

نظام SEO شامل للمتجر — معايير 2026 لمتاجر التجارة الإلكترونية.

## ما هو متاح

| البند                        | كيف يعمل                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| روابط نظيفة                  | `slugify()` يدعم العربية + اللاتينية في `src/lib/seo.ts`        |
| Meta Titles                  | `buildMeta()` يقصّ تلقائيًا إلى ≤60 حرف                          |
| Meta Descriptions            | `buildMeta()` يقصّ تلقائيًا إلى ≤160 حرف                         |
| Sitemap                      | `/sitemap.xml` ديناميكي (static + categories)                    |
| Robots.txt                   | `/robots.txt` يحجب admin/account/checkout/api                    |
| Schema المنتجات              | `productJsonLd()` بـ Offer + availability + price                |
| Schema التقييمات             | `aggregateRating` + `review[]` مدمج في `productJsonLd`           |
| Schema المنظمة               | `organizationJsonLd()` مع sameAs + contactPoint                  |
| Canonical URLs               | `<link rel="canonical">` تلقائي لكل صفحة                          |
| Open Graph + Twitter         | كامل: title, description, image, url, type, site_name            |
| تحسين الصور                  | `<LazyImage>` + `og:image` ≥ 1200x630, `max-image-preview:large` |
| فهرسة الأقسام                | `/category/$slug` بـ `head()` مخصّص + breadcrumb JSON-LD          |
| فهرسة المنتجات               | نفس الـ route + `productJsonLd`                                  |
| منتج غير متوفر               | `availability: out_of_stock` + `robots: "noindex, follow"`       |
| منتج محذوف                   | route يرمي `notFound()` → 404 + `noindex`. للمحذوف نهائيًا: 410   |
| Redirects                    | عبر `beforeLoad` + `redirect()` في الـ route                      |
| صفحات هبوط                   | `/landing/$slug` لكل حملة بـ meta/OG مخصّص                       |

## الاستخدام

### Route عادي
```tsx
import { buildMeta, breadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => buildMeta({
    title: "عن Maisonnét",
    description: "بوتيك أزياء أطفال فاخرة منذ 2020.",
    path: "/about",
    jsonLd: [breadcrumbJsonLd([
      { name: "الرئيسية", path: "/" },
      { name: "عن المتجر", path: "/about" },
    ])],
  }),
  component: About,
});
```

### صفحة منتج
```tsx
head: ({ loaderData, params }) => buildMeta({
  title: `${product.name} | Maisonnét`,
  description: product.summary,
  image: product.images[0],
  path: `/category/${params.slug}`,
  type: "product",
  // إذا غير متوفر: لا نفهرس مؤقتًا
  robots: product.inStock ? undefined : "noindex, follow",
  jsonLd: [
    productJsonLd({
      ...product,
      availability: product.inStock ? "in_stock" : "out_of_stock",
      url: canonical(`/category/${params.slug}`),
    }),
    breadcrumbJsonLd([...]),
  ],
}),
```

### Redirect (URL قديم → جديد)
```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/old-slug")({
  beforeLoad: () => {
    throw redirect({ to: "/category/$slug", params: { slug: "new-slug" } });
  },
});
```

### منتج محذوف نهائيًا (410 Gone)
```tsx
loader: async ({ params }) => {
  const product = await fetchProduct(params.id);
  if (product?.deletedPermanently) {
    throw new Response("Gone", { status: 410 });
  }
  if (!product) throw notFound();
  return { product };
},
```

## قواعد عامة

- **عنوان واحد H1** لكل صفحة، يطابق `<title>` تقريبًا.
- **canonical** على كل صفحة، حتى الصفحة الرئيسية.
- لا تكرّر نفس `og:image` بين منتجات مختلفة — استخدم صورة المنتج الفعلية.
- لا تفهرس صفحات الفلاتر (`?sort=`, `?filter=`) — محجوبة في robots.txt.
- صفحات النتائج الفارغة تستخدم `noindex` لتجنب التضخّم.
- اعمل ping لـ Google Search Console بعد كل تحديث ضخم في الكتالوج.

## التحقق
- https://search.google.com/test/rich-results — لاختبار Schema
- https://www.opengraph.xyz — لاختبار OG/Twitter
- `/sitemap.xml` و `/robots.txt` — افتحها مباشرة للتحقق
