import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, ExternalLink, Copy, Trash2, Wand2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// System pages that map to live storefront routes. Editing them opens
// the live route with inline-edit enabled (?edit=1).
const SYSTEM_PAGES: { slug: string; title_ar: string; title_en: string; type: string; livePath: string }[] = [
  { slug: "home", title_ar: "الصفحة الرئيسية", title_en: "Home", type: "home", livePath: "/" },
  { slug: "product", title_ar: "صفحة المنتج", title_en: "Product page", type: "product", livePath: "/product/sample" },
  { slug: "product_card", title_ar: "بطاقة المنتج", title_en: "Product card", type: "product_card", livePath: "/" },
  { slug: "category", title_ar: "صفحة الفئة", title_en: "Category page", type: "category", livePath: "/category/all" },
  { slug: "checkout", title_ar: "صفحة الدفع", title_en: "Checkout", type: "checkout", livePath: "/checkout" },
];

function livePathFor(row: { slug: string; type?: string }): string {
  const sys = SYSTEM_PAGES.find((s) => s.slug === row.slug);
  if (sys) return sys.livePath;
  if (row.slug === "home") return "/";
  return `/page/${row.slug}`;
}

type Row = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  type: string;
  status: string;
  is_system: boolean;
  updated_at: string;
};

export const Route = createFileRoute("/admin/cms-pages/")({
  component: PagesList,
});

function PagesList() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cms_pages")
      .select("id,slug,title_ar,title_en,type,status,is_system,updated_at")
      .order("updated_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Ensure all built-in system pages exist as editable rows.
  const seedSystemPages = async () => {
    const { data: existing } = await supabase.from("cms_pages").select("slug").in("slug", SYSTEM_PAGES.map((p) => p.slug));
    const existingSlugs = new Set(((existing as { slug: string }[]) ?? []).map((r) => r.slug));
    const missing = SYSTEM_PAGES.filter((p) => !existingSlugs.has(p.slug));
    if (missing.length === 0) { toast.info(ar ? "الصفحات الأساسية موجودة" : "System pages already exist"); return; }
    const { error } = await supabase.from("cms_pages").insert(
      missing.map((p) => ({
        slug: p.slug,
        title_ar: p.title_ar,
        title_en: p.title_en,
        type: p.type,
        status: "draft",
        is_system: true,
        draft_content: { sections: [] } as any,
      })),
    );
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? `تمت إضافة ${missing.length} صفحة` : `Added ${missing.length} pages`);
    load();
  };

  const createPage = async () => {
    if (!newTitle.trim() || !newSlug.trim()) { toast.error("العنوان والرابط مطلوبان"); return; }
    const slug = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { error } = await supabase.from("cms_pages").insert({
      slug, title_ar: newTitle, title_en: newTitle, type: "custom", status: "draft",
      draft_content: { sections: [] } as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء الصفحة");
    setNewOpen(false); setNewTitle(""); setNewSlug("");
    load();
  };

  const duplicatePage = async (row: Row) => {
    const { data } = await supabase.from("cms_pages").select("*").eq("id", row.id).maybeSingle();
    if (!data) return;
    const d: any = data;
    const newSlug = `${d.slug}-copy-${Date.now().toString(36)}`;
    const { error } = await supabase.from("cms_pages").insert({
      slug: newSlug,
      title_ar: d.title_ar + " (نسخة)",
      title_en: d.title_en + " (Copy)",
      type: "custom",
      status: "draft",
      is_system: false,
      draft_content: d.draft_content,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم النسخ");
    load();
  };

  const deletePage = async (row: Row) => {
    if (!confirm(`حذف "${row.title_ar}"؟ لا يمكن التراجع.`)) return;
    const { error } = await supabase.from("cms_pages").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">محرر الصفحات</h1>
          <p className="text-sm text-muted-foreground">عدّل صفحات الموقع بصرياً وانشرها مباشرة.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 me-1" /> صفحة جديدة</Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="text-start p-3">العنوان</th>
              <th className="text-start p-3">الرابط</th>
              <th className="text-start p-3">النوع</th>
              <th className="text-start p-3">الحالة</th>
              <th className="text-start p-3">آخر تعديل</th>
              <th className="text-end p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">جاري التحميل…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد صفحات.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-medium">{ar ? r.title_ar : r.title_en}</td>
                <td className="p-3 text-muted-foreground"><code>/{r.slug === "home" ? "" : r.slug}</code></td>
                <td className="p-3 text-xs">{r.type}</td>
                <td className="p-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${r.status === "published" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                    {r.status === "published" ? "منشورة" : "مسودة"}
                  </span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/admin/cms-pages/$id" params={{ id: r.id }}><Edit className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={r.slug === "home" ? "/" : `/page/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicatePage(r)}><Copy className="h-3.5 w-3.5" /></Button>
                    {!r.is_system && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePage(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>صفحة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">العنوان</Label>
              <Input value={newTitle} onChange={(e) => {
                setNewTitle(e.target.value);
                if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }} />
            </div>
            <div>
              <Label className="text-xs">الرابط (Slug)</Label>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="about-us" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>إلغاء</Button>
            <Button onClick={createPage}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
