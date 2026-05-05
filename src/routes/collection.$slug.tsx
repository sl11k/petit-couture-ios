import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { LazyImage } from "@/components/LazyImage";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { buildMeta, breadcrumbJsonLd, collectionJsonLd, canonical } from "@/lib/seo";

type SortMode = "manual" | "newest" | "best_sellers" | "price_asc" | "price_desc";

type CollectionPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  hero_image: string | null;
  cta_text: string | null;
  cta_url: string | null;
  product_ids: string[];
  coupon_code: string | null;
  sort_mode: SortMode;
  show_as_collection: boolean;
};

type Product = {
  id: string;
  slug: string | null;
  name_ar: string | null;
  name_en: string | null;
  price: number | null;
  image_url: string | null;
  sales_count: number | null;
  created_at: string;
};

async function loadCollection(slug: string): Promise<{ page: CollectionPage; products: Product[] } | null> {
  const { data: page } = await supabase
    .from("landing_pages")
    .select("id, slug, title, subtitle, description, hero_image, cta_text, cta_url, product_ids, coupon_code, sort_mode, show_as_collection")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!page) return null;

  let products: Product[] = [];
  if (page.product_ids?.length) {
    const { data } = await supabase
      .from("products")
      .select("id, slug, name_ar, name_en, price, image_url, sales_count, created_at")
      .in("id", page.product_ids)
      .eq("is_active", true);
    const list = (data ?? []) as Product[];

    if (page.sort_mode === "manual") {
      const order = new Map(page.product_ids.map((id, i) => [id, i]));
      products = list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else if (page.sort_mode === "newest") {
      products = list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (page.sort_mode === "best_sellers") {
      products = list.sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0));
    } else if (page.sort_mode === "price_asc") {
      products = list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (page.sort_mode === "price_desc") {
      products = list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
  }

  return { page: page as CollectionPage, products };
}

export const Route = createFileRoute("/collection/$slug")({
  loader: async ({ params }) => {
    const data = await loadCollection(params.slug);
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.page;
    if (!p) {
      return buildMeta({
        title: "Collection — Le Petit Paradis",
        description: "",
        path: `/collection/${params.slug}`,
        noindex: true,
      });
    }
    return buildMeta({
      title: `${p.title} | Le Petit Paradis`,
      description: p.description ?? p.subtitle ?? p.title,
      image: p.hero_image ?? undefined,
      path: `/collection/${p.slug}`,
      type: "website",
      jsonLd: [
        breadcrumbJsonLd([
          { name: "الرئيسية", path: "/" },
          { name: p.title, path: `/collection/${p.slug}` },
        ]),
        collectionJsonLd({
          name: p.title,
          description: p.description ?? "",
          url: canonical(`/collection/${p.slug}`),
          items: (loaderData?.products ?? []).map((it) => ({
            name: it.name_ar ?? it.name_en ?? "",
            url: it.slug ? `/product/${it.slug}` : `/`,
            image: it.image_url ?? "",
            price: it.price ?? 0,
            currency: "SAR",
            brand: "Le Petit Paradis",
            sku: it.id,
            availability: "in_stock" as const,
          })),
          image: p.hero_image ?? "",
          inLanguage: "ar-SA",
        }),
      ],
    });
  },
  notFoundComponent: () => (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-medium">المجموعة غير متوفرة</h1>
        <Link to="/" className="inline-block mt-4 underline text-primary">الرئيسية</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-[60vh] grid place-items-center px-4 text-center">
      <p>{(error as Error).message}</p>
    </div>
  ),
  component: CollectionView,
});

function CollectionView() {
  const { page, products } = Route.useLoaderData();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  // Page rendered — view counting handled server-side via analytics if needed.

  return (
    <main className="min-h-screen">
      {/* Hero */}
      {page.hero_image ? (
        <section className="relative">
          <LazyImage
            src={page.hero_image}
            alt={page.title}
            eager
            width={1600}
            height={900}
            aspect="16/9"
            className="w-full aspect-[4/5] sm:aspect-[16/9] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6 sm:p-10 text-white">
            <h1 className="font-serif text-2xl sm:text-4xl">{page.title}</h1>
            {page.subtitle && <p className="mt-2 text-sm sm:text-base max-w-xl">{page.subtitle}</p>}
            {page.cta_text && page.cta_url && (
              <a href={page.cta_url} className="mt-4 inline-block w-fit">
                <Button size="lg" className="h-12 px-8">{page.cta_text}</Button>
              </a>
            )}
          </div>
        </section>
      ) : (
        <section className="px-6 py-10 max-w-5xl mx-auto text-center">
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground">{page.title}</h1>
          {page.subtitle && <p className="mt-3 text-muted-foreground">{page.subtitle}</p>}
        </section>
      )}

      {page.description && (
        <section className="px-6 py-6 max-w-3xl mx-auto text-center text-sm sm:text-base text-muted-foreground leading-relaxed">
          {page.description}
        </section>
      )}

      {page.coupon_code && (
        <section className="px-6 max-w-3xl mx-auto">
          <div className="rounded-md border border-gold/40 bg-cream-warm px-4 py-3 text-center text-sm">
            {ar ? "استخدم كود الخصم: " : "Use code: "}
            <span className="font-mono font-semibold text-gold-deep">{page.coupon_code}</span>
          </div>
        </section>
      )}

      {/* Products grid */}
      <section className="px-4 sm:px-6 py-10 max-w-7xl mx-auto">
        {products.length === 0 ? (
          <p className="text-center text-muted-foreground">{ar ? "لا توجد منتجات في هذه المجموعة بعد." : "No products in this collection yet."}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p: any) => (
              <ProductCard key={p.id} p={p} ar={ar} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ProductCard({ p, ar }: { p: Product; ar: boolean }) {
  const name = ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar);
  const href = p.slug ? `/product/${p.slug}` : "#";
  return (
    <a href={href} className="group block">
      {p.image_url ? (
        <LazyImage
          src={p.image_url}
          alt={name ?? ""}
          width={500}
          height={625}
          aspect="4/5"
          className="w-full aspect-[4/5] object-cover rounded-md group-hover:opacity-90 transition"
        />
      ) : (
        <div className="aspect-[4/5] bg-muted rounded-md" />
      )}
      <div className="mt-2.5">
        <p className="text-sm text-foreground line-clamp-1">{name}</p>
        {p.price != null && (
          <p className="text-[13px] text-gold-deep mt-0.5">{p.price.toFixed(2)} {ar ? "ر.س" : "SAR"}</p>
        )}
      </div>
    </a>
  );
}
