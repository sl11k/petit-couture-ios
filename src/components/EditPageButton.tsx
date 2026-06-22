import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLiveEdit } from "@/live-edit/LiveEditContext";
import { ThemeEditor } from "@/theme-customizer/ThemeEditor";

/**
 * Floating "Edit this page" button for admins.
 * Toggles the in-page Live Edit mode for the given slug.
 */
export function EditPageButton({ slug = "home" }: { slug?: string }) {
  const { roles, loading } = useUserRole();
  const { isRTL } = useLanguage();
  const live = useLiveEdit();
  const [pageId, setPageId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  const isAdmin = roles.some((r) =>
    ["super_admin", "admin", "content_manager", "manager", "store_manager"].includes(r),
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("cms_pages").select("id").eq("slug", slug).maybeSingle();
      if (!cancelled) setPageId(data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, slug]);

  const start = async () => {
    if (slug === "home") {
      setStudioOpen(true);
      return;
    }
    let id = pageId;
    if (!id) {
      const titleMap: Record<string, { ar: string; en: string; type: string }> = {
        home: { ar: "الصفحة الرئيسية", en: "Home", type: "home" },
        product: { ar: "صفحة المنتج", en: "Product page", type: "product" },
        product_card: { ar: "بطاقة المنتج", en: "Product card", type: "product_card" },
        checkout: { ar: "صفحة الدفع", en: "Checkout", type: "checkout" },
        category: { ar: "صفحة الفئة", en: "Category page", type: "category" },
      };
      const meta = titleMap[slug] ?? { ar: slug, en: slug, type: "custom" };
      const { data, error } = await supabase
        .from("cms_pages")
        .insert({
          slug,
          title_ar: meta.ar,
          title_en: meta.en,
          type: meta.type,
          status: "draft",
          draft_content: { sections: [] } as never,
          is_system: ["home", "product", "product_card", "checkout", "category"].includes(slug),
        })
        .select("id")
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      id = data?.id ?? null;
      setPageId(id);
    }
    if (id) live.start(slug, id);
  };

  // Auto-start when URL contains ?edit=1 (admin-only)
  useEffect(() => {
    if (!isAdmin || live.enabled || studioOpen) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("edit") === "1") {
      const t = setTimeout(() => {
        start();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isAdmin, live.enabled, pageId, studioOpen]);

  if (loading || !isAdmin) return null;
  if (live.enabled) return null;
  if (studioOpen) return <ThemeEditor onClose={() => setStudioOpen(false)} />;

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
