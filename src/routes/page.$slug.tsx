import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { buildMeta } from "@/lib/seo";

type Page = {
  slug: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  meta_description_ar: string | null;
  meta_description_en: string | null;
};

export const Route = createFileRoute("/page/$slug")({
  head: ({ params }) =>
    buildMeta({
      title: params.slug,
      description: "Le Petit Paradis",
      path: `/page/${params.slug}`,
    }),
  component: PageView,
});

function PageView() {
  const { slug } = Route.useParams();
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("content_pages")
        .select("slug,title_ar,title_en,body_ar,body_en,meta_description_ar,meta_description_en")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (cancelled) return;
      setPage((data as Page) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-muted-foreground">…</div>;
  }
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center" dir={isRTL ? "rtl" : "ltr"}>
        <h1 className="text-2xl font-semibold">{ar ? "الصفحة غير موجودة" : "Page not found"}</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          {ar ? "العودة للرئيسية" : "Back to home"}
        </Link>
      </div>
    );
  }
  return (
    <article className="mx-auto max-w-3xl px-4 py-10" dir={isRTL ? "rtl" : "ltr"}>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{ar ? page.title_ar : page.title_en}</h1>
      <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap text-foreground/90">
        {ar ? page.body_ar : page.body_en}
      </div>
    </article>
  );
}
