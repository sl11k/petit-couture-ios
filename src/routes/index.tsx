import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isPageContent } from "@/page-builder/schemas/pageSchema";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { useLiveEdit } from "@/live-edit/LiveEditContext";
import { HomeScreen } from "@/components/HomeScreen";
import { buildMeta, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () => {
    const { data } = await supabase
      .from("cms_pages")
      .select("published_content")
      .eq("slug", "home")
      .maybeSingle();
    if (!isPageContent(data?.published_content)) return { sections: [] };
    return {
      sections: data.published_content.sections.filter((section) => section.type !== "legacy_home"),
    };
  },
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
  const content = Route.useLoaderData();
  return (
    <>
      <HomeScreen />
      {!live.enabled && content.sections.length > 0 && <PageRenderer content={content} />}
    </>
  );
}
