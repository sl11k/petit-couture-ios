import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Floating "Edit this page" button for admins.
 * Looks up the CMS page id for the given slug (defaults to "home")
 * and links straight to its editor. Hidden for non-admins.
 */
export function EditPageButton({ slug = "home" }: { slug?: string }) {
  const { roles, loading } = useUserRole();
  const { isRTL } = useLanguage();
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

  const to = pageId ? `/admin/cms-pages/${pageId}` : "/admin/cms-pages";
  return (
    <Link
      to={to as any}
      className="fixed bottom-24 lg:bottom-8 end-5 z-50 inline-flex items-center gap-2 h-11 px-4 rounded-full bg-foreground text-background shadow-xl hover:opacity-90 transition text-[12px] tracking-soft"
      aria-label={isRTL ? "تعديل هذه الصفحة" : "Edit this page"}
    >
      <Pencil className="h-4 w-4" strokeWidth={1.8} />
      {isRTL ? "تعديل الصفحة" : "Edit page"}
    </Link>
  );
}
