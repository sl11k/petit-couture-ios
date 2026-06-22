import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { isPageContent, type PageContent } from "@/page-builder/schemas/pageSchema";
import { supabase } from "@/integrations/supabase/client";
import { EditPageButton } from "@/components/EditPageButton";
import { pickAbVariant } from "@/live-edit/AbVariantManager";
import { useApplyOverrides } from "@/live-edit/useApplyOverrides";
import { useThemeCustomizer } from "@/theme-customizer/ThemeProvider";
import { ThemeRenderer } from "@/theme-customizer/ThemeRenderer";
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
  const theme = useThemeCustomizer();
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

  useApplyOverrides("/");
  // Preserve the original data-backed homepage until an admin explicitly saves
  // a visual theme. Saved themes use the same global storefront shell/chrome.
  return (<>{theme.hasSavedTheme ? <ThemeRenderer config={theme.config} /> : <HomeScreen />}<EditPageButton slug="home" /></>);
}
