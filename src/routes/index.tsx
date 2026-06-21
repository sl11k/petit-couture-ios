import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { isPageContent, type PageContent } from "@/page-builder/schemas/pageSchema";
import { supabase } from "@/integrations/supabase/client";
import { EditPageButton } from "@/components/EditPageButton";
import { useLiveEdit } from "@/live-edit/LiveEditContext";
import { LiveEditCanvas } from "@/live-edit/LiveEditHome";
import { pickAbVariant } from "@/live-edit/AbVariantManager";
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
      let pc = (data as any)?.published_content;
      if (isPageContent(pc) && pc.sections.length > 0) {
        // A/B variant pick (sticky per visitor)
        pc = await pickAbVariant("home", pc);
        const onlyLegacy = pc.sections.length === 1 && pc.sections[0].type === "legacy_home";
        setContent(onlyLegacy ? null : pc);
      }
      setLoaded(true);
    })().catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const live = useLiveEdit();
  if (live.enabled) {
    return <LiveEditCanvas fallback={content ? <PageRenderer content={content} /> : <HomeScreen />} />;
  }
  if (!loaded) return (<><HomeScreen /><EditPageButton slug="home" /></>);
  if (content) return (<><PageRenderer content={content} /><EditPageButton slug="home" /></>);
  return (<><HomeScreen /><EditPageButton slug="home" /></>);
}
