import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { EditPageButton } from "@/components/EditPageButton";
import { useApplyOverrides } from "@/live-edit/useApplyOverrides";
import { supabase } from "@/integrations/supabase/client";
import { isPageContent, type PageContent } from "@/page-builder/schemas/pageSchema";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { useLiveEdit } from "@/live-edit/LiveEditContext";
import { buildMeta, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

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
  const live = useLiveEdit();
  const [addedContent, setAddedContent] = useState<PageContent>({ sections: [] });
  useEffect(() => {
    let active = true;
    supabase
      .from("cms_pages")
      .select("published_content")
      .eq("slug", "home")
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !isPageContent(data?.published_content)) return;
        setAddedContent({
          sections: data.published_content.sections.filter(
            (section) => section.type !== "legacy_home",
          ),
        });
      });
    return () => {
      active = false;
    };
  }, []);
  useApplyOverrides("/");
  return (
    <>
      <HomeScreen />
      {!live.enabled && addedContent.sections.length > 0 && <PageRenderer content={addedContent} />}
      <EditPageButton slug="home" />
    </>
  );
}
