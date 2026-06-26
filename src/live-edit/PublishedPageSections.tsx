import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageRenderer } from "@/page-builder/components/PageRenderer";
import { isPageContent, type PageContent } from "@/page-builder/schemas/pageSchema";
import { useLiveEdit } from "./LiveEditContext";

export function PublishedPageSections({
  slug,
  onLoaded,
}: {
  slug: string;
  onLoaded?: (hasSections: boolean) => void;
}) {
  const live = useLiveEdit();
  const [content, setContent] = useState<PageContent>({ sections: [] });

  useEffect(() => {
    let active = true;
    setContent({ sections: [] });
    supabase
      .from("cms_pages")
      .select("published_content")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!isPageContent(data?.published_content)) {
          onLoaded?.(false);
          return;
        }
        const sections = data.published_content.sections.filter(
          (section) => section.type !== "legacy_home",
        );
        setContent({ sections });
        onLoaded?.(sections.length > 0);
      });
    return () => {
      active = false;
    };
  }, [slug, onLoaded]);

  if (live.enabled || content.sections.length === 0) return null;
  return <PageRenderer content={content} />;
}
