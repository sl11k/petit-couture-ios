import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { buildMeta, breadcrumbJsonLd, collectionJsonLd, canonical } from "@/lib/seo";
import { devValidateJsonLd } from "@/lib/seoValidate";
import { Button } from "@/components/ui/button";
import { LazyImage } from "@/components/LazyImage";
import { categories, productsByCategory, type Product } from "@/data/categories";

type LandingItem = {
  name: string; url: string; image: string; price: number;
  currency: string; brand: string; sku: string;
  availability: "in_stock" | "out_of_stock";
};

function buildLandingItems(slugs: string[]): LandingItem[] {
  return slugs
    .map((s) => {
      const cat = categories.find((cc) => cc.slug === s);
      const p: Product | undefined = productsByCategory[s];
      if (!cat || !p) return null;
      return {
        name: p.name,
        url: `/category/${s}`,
        image: p.images?.[0] ?? cat.img,
        price: p.price,
        currency: (p as any).currency ?? "SAR",
        brand: p.brand,
        sku: p.sku,
        availability:
          (p as any).inStock === false ? ("out_of_stock" as const) : ("in_stock" as const),
      };
    })
    .filter(Boolean) as LandingItem[];
}

function buildLandingJsonLd(c: {
  slug: string; title: string; description: string; hero: string; featuredCategorySlugs: string[];
}) {
  const path = `/landing/${c.slug}`;
  const items = buildLandingItems(c.featuredCategorySlugs);
  return [
    breadcrumbJsonLd([
      { name: "الرئيسية", path: "/" },
      { name: "الحملات", path: "/landing" },
      { name: c.title, path },
    ]),
    collectionJsonLd({
      name: c.title,
      description: c.description,
      url: canonical(path),
      items,
      image: c.hero,
      inLanguage: "ar-SA",
    }),
  ];
}

/**
 * صفحات هبوط للحملات: /landing/$slug
 * مُحسّنة للـ SEO + Conversion: hero واضح، CTA كبير، روابط للأقسام،
 * meta مخصّص لكل حملة. أمثلة slugs: "summer-sale", "back-to-school", "eid-gifts"
 */

type Campaign = {
  slug: string;
  title: string;
  description: string;
  hero: string;
  ctaLabel: string;
  ctaHref: string;
  featuredCategorySlugs: string[];
};

const CAMPAIGNS: Campaign[] = [
  {
    slug: "summer-sale",
    title: "تخفيضات الصيف — حتى 50% خصم",
    description:
      "اكتشف تشكيلة الصيف من Le Petit Paradis بخصومات تصل إلى 50%. سباحة، فساتين خفيفة، وأكثر — توصيل مجاني لطلبات +200 ر.س.",
    hero: "/og-default.jpg",
    ctaLabel: "تسوق العرض",
    ctaHref: "/category/swimwear",
    featuredCategorySlugs: ["swimwear", "dresses", "tops"],
  },
  {
    slug: "eid-gifts",
    title: "هدايا العيد للأطفال — مجموعة فاخرة",
    description:
      "اختيارات Le Petit Paradis لهدايا العيد: مجموعات أنيقة، أحذية، ولفائف هدايا مجانية. اطلب الآن قبل العيد.",
    hero: "/og-default.jpg",
    ctaLabel: "اكتشف الهدايا",
    ctaHref: "/category/gifts",
    featuredCategorySlugs: ["gifts", "outfit-sets", "shoes"],
  },
  {
    slug: "back-to-school",
    title: "العودة للمدارس — تشكيلة 2026",
    description:
      "حقائب، أحذية، وملابس تليق بأطفالك في عامهم الدراسي. خصومات حصرية وتوصيل سريع من Le Petit Paradis.",
    hero: "/og-default.jpg",
    ctaLabel: "تسوق الآن",
    ctaHref: "/category/bags",
    featuredCategorySlugs: ["bags", "shoes", "tops"],
  },
];

export const Route = createFileRoute("/landing/$slug")({
  loader: async ({ params }) => {
    // 1) Static campaign (legacy hard-coded)
    const c = CAMPAIGNS.find((x) => x.slug === params.slug);
    if (c) return { campaign: c };

    // 2) DB-backed landing page authored from the admin panel
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: page } = await supabase
      .from("landing_pages")
      .select("slug, title, description, hero_image, cta_text, cta_url, product_ids")
      .eq("slug", params.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!page) throw notFound();
    // Map landing_pages row → Campaign shape so the component renders unchanged
    const ctaHref = (page as any).cta_url || "/";
    return {
      campaign: {
        slug: (page as any).slug,
        title: (page as any).title || params.slug,
        description: (page as any).description || "",
        hero: (page as any).hero_image || "/og-default.jpg",
        ctaLabel: (page as any).cta_text || "تسوّق الآن",
        ctaHref,
        // No featured-category mapping for DB landings; component handles empty array safely
        featuredCategorySlugs: [] as string[],
      } satisfies Campaign,
    };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.campaign;
    if (!c) {
      return buildMeta({
        title: "Campaign — Le Petit Paradis",
        description: "حملة Le Petit Paradis",
        path: `/landing/${params.slug}`,
        noindex: true,
      });
    }
    return buildMeta({
      title: `${c.title} | Le Petit Paradis`,
      description: c.description,
      image: c.hero,
      path: `/landing/${c.slug}`,
      type: "website",
      jsonLd: buildLandingJsonLd(c),
    });
  },
  notFoundComponent: () => (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-medium">الحملة غير متوفرة</h1>
        <p className="text-muted-foreground mt-2">
          ربما انتهت صلاحيتها. تصفّح المتجر للاطلاع على آخر العروض.
        </p>
        <Link
          to="/"
          className="inline-block mt-4 underline text-primary"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <p>{(error as Error).message}</p>
    </div>
  ),
  component: LandingPage,
});

function LandingPage() {
  const { campaign } = Route.useLoaderData();
  const featured = campaign.featuredCategorySlugs
    .map((s: string) => categories.find((c) => c.slug === s))
    .filter(Boolean) as typeof categories;

  useEffect(() => {
    devValidateJsonLd(`landing:${campaign.slug}`, buildLandingJsonLd(campaign));
  }, [campaign]);

  return (
    <main className="lg:hidden lg:min-h-0 min-h-[100vh]">
      {/* Hero */}
      <section className="relative">
        <LazyImage
          src={campaign.hero}
          alt={campaign.title}
          eager
          width={1600}
          height={2000}
          aspect="4/5"
          className="w-full aspect-[4/5] sm:aspect-[16/9] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-6 text-white">
          <h1 className="text-2xl sm:text-4xl font-serif">{campaign.title}</h1>
          <p className="mt-2 text-sm sm:text-base max-w-xl">
            {campaign.description}
          </p>
          <Link to={campaign.ctaHref as any} className="mt-4 inline-block">
            <Button size="lg" className="h-12 px-8">
              {campaign.ctaLabel}
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured categories — hidden when the DB-backed landing has no static category mapping */}
      {featured.length > 0 && (
        <section className="px-4 py-8 max-w-5xl mx-auto">
          <h2 className="text-xl font-medium mb-4">من الحملة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {featured.map((c) => (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group block"
              >
                <LazyImage
                  src={c.img}
                  alt={c.name}
                  width={400}
                  height={400}
                  aspect="1/1"
                  className="aspect-square w-full object-cover rounded-lg"
                />
                <p className="mt-2 text-sm text-center group-hover:text-primary">
                  {c.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
