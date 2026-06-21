import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLiveEdit } from "@/live-edit/LiveEditContext";

/**
 * Floating "Edit this page" button for admins.
 * Toggles the in-page Live Edit mode for the given slug.
 */
export function EditPageButton({ slug = "home" }: { slug?: string }) {
  const { roles, loading } = useUserRole();
  const { isRTL } = useLanguage();
  const live = useLiveEdit();
  const [pageId, setPageId] = useState<string | null>(null);

  const isAdmin = roles.some((r) =>
    ["super_admin", "admin", "content_manager", "manager", "store_manager"].includes(r),
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("cms_pages")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!cancelled) setPageId((data as any)?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, slug]);

  if (loading || !isAdmin) return null;
  // Hide the floating button while editing — the toolbar handles exit.
  if (live.enabled) return null;

  const start = async () => {
    let id = pageId;
    if (!id) {
      // auto-create a draft page if missing (only for home)
      const { data, error } = await supabase
        .from("cms_pages")
        .insert({
          slug,
          title_ar: slug === "home" ? "الصفحة الرئيسية" : slug,
          title_en: slug === "home" ? "Home" : slug,
          type: slug === "home" ? "home" : "custom",
          status: "draft",
          draft_content: { sections: [] } as any,
          is_system: slug === "home",
        })
        .select("id")
        .maybeSingle();
      if (error) { console.error(error); return; }
      id = (data as any)?.id ?? null;
      setPageId(id);
    }
    if (id) live.start(slug, id);
  };

  return (
    <button
      onClick={start}
      className="fixed bottom-24 lg:bottom-8 end-5 z-50 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-foreground text-background shadow-xl hover:opacity-90 transition text-[12px] tracking-soft"
      aria-label={isRTL ? "تعديل هذه الصفحة" : "Edit this page"}
    >
      <Pencil className="h-4 w-4" strokeWidth={1.8} />
      {isRTL ? "تعديل الصفحة" : "Edit page"}
    </button>
  );
}
