import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { isPageContent, type PageContent } from "@/page-builder/schemas/pageSchema";
import { supabase } from "@/integrations/supabase/client";
import {
  buildMeta,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    buildMeta({
      title: "Le Petit Paradis — أزياء الأطفال الفاخرة",
      description:
        "بوتيك Le Petit Paradis: أزياء أطفال فاخرة مختارة بعناية — فساتين، أحذية، وهدايا للرضّع والبنات والأولاد. توصيل سريع وإرجاع مجاني.",
      path: "/",
      type: "website",
      jsonLd: [organizationJsonLd(), websiteJsonLd()],
      alternateLocales: [
        { hreflang: "ar-SA", path: "/" },
        { hreflang: "en", path: "/" },
        { hreflang: "x-default", path: "/" },
      ],
    }),
  component: Index,
});

function Index() {
  const [content, setContent] = useState<PageContent | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("cms_pages")
        .select("published_content")
        .eq("slug", "home")
        .eq("status", "published")
        .maybeSingle();
      if (cancelled) return;
      const pc = (data as any)?.published_content;
      if (isPageContent(pc) && pc.sections.length > 0) {
        // Skip pure legacy-only pages — let HomeScreen render directly to keep behavior identical.
        const onlyLegacy = pc.sections.length === 1 && pc.sections[0].type === "legacy_home";
        setContent(onlyLegacy ? null : pc);
      }
      setLoaded(true);
    })().catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return <HomeScreen />;
  if (content) return <PageRenderer content={content} />;
  return <HomeScreen />;
}
