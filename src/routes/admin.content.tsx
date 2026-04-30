import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  FileText, Plus, Search, Edit2, Trash2, Eye, EyeOff,
  CheckCircle2, X, ExternalLink, Save,
} from "lucide-react";

export const Route = createFileRoute("/admin/content")({ component: ContentAdmin });

type Page = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  meta_description_ar: string | null;
  meta_description_en: string | null;
  is_published: boolean;
  show_in_footer: boolean;
  sort_order: number;
  updated_at: string;
};

const EMPTY: Omit<Page, "id" | "updated_at"> = {
  slug: "", title_ar: "", title_en: "", body_ar: "", body_en: "",
  meta_description_ar: "", meta_description_en: "",
  is_published: false, show_in_footer: false, sort_order: 0,
};

function ContentAdmin() {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const { isSuperAdmin, can } = useUserRole();
  const allowed = isSuperAdmin || can("content.manage");

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [editing, setEditing] = useState<(Page | (typeof EMPTY & { id?: string })) | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("content_pages")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });
    setPages((data ?? []) as Page[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (filter === "published" && !p.is_published) return false;
      if (filter === "draft" && p.is_published) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        return (
          p.slug.toLowerCase().includes(s) ||
          p.title_ar.toLowerCase().includes(s) ||
          p.title_en.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [pages, q, filter]);

  async function save() {
    if (!editing || !allowed) return;
    setSaving(true);
    const payload = {
      slug: editing.slug.trim(),
      title_ar: editing.title_ar.trim(),
      title_en: editing.title_en.trim(),
      body_ar: editing.body_ar,
      body_en: editing.body_en,
      meta_description_ar: editing.meta_description_ar,
      meta_description_en: editing.meta_description_en,
      is_published: editing.is_published,
      show_in_footer: editing.show_in_footer,
      sort_order: editing.sort_order,
    };
    let error;
    if ("id" in editing && editing.id) {
      ({ error } = await supabase.from("content_pages").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("content_pages").insert(payload));
    }
    setSaving(false);
    if (error) {
      flash(ar ? `خطأ: ${error.message}` : `Error: ${error.message}`);
      return;
    }
    flash(ar ? "تم الحفظ" : "Saved");
    setEditing(null);
    void load();
  }

  async function togglePublish(p: Page) {
    if (!allowed) return;
    await supabase.from("content_pages").update({ is_published: !p.is_published }).eq("id", p.id);
    void load();
  }

  async function remove(p: Page) {
    if (!allowed) return;
    if (!confirm(ar ? `حذف "${p.title_ar}"؟` : `Delete "${p.title_en}"?`)) return;
    await supabase.from("content_pages").delete().eq("id", p.id);
    flash(ar ? "تم الحذف" : "Deleted");
    void load();
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {ar ? "إدارة المحتوى" : "Content management"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {ar
                  ? "صفحات ثابتة (سياسات، من نحن، شروط) — تظهر للعملاء عبر روابط الفوتر."
                  : "Static pages (policies, about, terms) — visible to customers via footer links."}
              </p>
            </div>
            {allowed && (
              <button
                onClick={() => setEditing({ ...EMPTY })}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> {ar ? "صفحة جديدة" : "New page"}
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className={`pointer-events-none absolute ${isRTL ? "right-2.5" : "left-2.5"} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "ابحث بالرابط أو العنوان…" : "Search slug or title…"}
                className={`w-full rounded-md border border-border bg-background py-2 ${isRTL ? "pr-8 pl-3" : "pl-8 pr-3"} text-sm focus:outline-none focus:ring-1 focus:ring-primary`}
              />
            </div>
            <div className="flex rounded-md border border-border p-0.5">
              {(["all","published","draft"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded ${filter===f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {ar
                    ? f==="all" ? "الكل" : f==="published" ? "منشور" : "مسودة"
                    : f==="all" ? "All" : f==="published" ? "Published" : "Draft"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{ar ? "جاري التحميل…" : "Loading…"}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد صفحات بعد." : "No pages yet."}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className={`px-3 py-2 ${isRTL ? "text-right" : "text-left"}`}>{ar ? "العنوان" : "Title"}</th>
                  <th className={`px-3 py-2 ${isRTL ? "text-right" : "text-left"}`}>{ar ? "الرابط" : "Slug"}</th>
                  <th className="px-3 py-2 text-center">{ar ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2 text-center">{ar ? "في الفوتر" : "Footer"}</th>
                  <th className={`px-3 py-2 ${isRTL ? "text-right" : "text-left"}`}>{ar ? "آخر تحديث" : "Updated"}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">{ar ? p.title_ar : p.title_en}</div>
                      <div className="text-[11px] text-muted-foreground">{ar ? p.title_en : p.title_ar}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">/{p.slug}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => togglePublish(p)}
                        disabled={!allowed}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${p.is_published ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-muted text-muted-foreground"}`}
                      >
                        {p.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {p.is_published ? (ar ? "منشور" : "Live") : (ar ? "مسودة" : "Draft")}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {p.show_in_footer && <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-primary" />}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString(ar ? "ar" : "en")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/page/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={ar ? "عرض" : "View"}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        {allowed && (
                          <>
                            <button
                              onClick={() => setEditing(p)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={ar ? "تعديل" : "Edit"}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => remove(p)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Editor drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex" dir={isRTL ? "rtl" : "ltr"}>
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setEditing(null)} />
          <div className={`relative ml-auto h-full w-full max-w-3xl overflow-y-auto bg-card shadow-2xl ${isRTL ? "mr-auto ml-0" : ""}`}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
              <h3 className="text-base font-semibold text-foreground">
                {"id" in editing && editing.id ? (ar ? "تعديل صفحة" : "Edit page") : (ar ? "صفحة جديدة" : "New page")}
              </h3>
              <button
                onClick={() => !saving && setEditing(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label={ar ? "العنوان (عربي)" : "Title (AR)"}>
                  <input
                    value={editing.title_ar}
                    onChange={(e) => setEditing({ ...editing, title_ar: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label={ar ? "العنوان (إنجليزي)" : "Title (EN)"}>
                  <input
                    value={editing.title_en}
                    onChange={(e) => setEditing({ ...editing, title_en: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label={ar ? "الرابط (slug)" : "Slug"} hint={ar ? `يظهر بالرابط: /page/${editing.slug || "your-slug"}` : `URL: /page/${editing.slug || "your-slug"}`}>
                <input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() })}
                  placeholder="about"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </Field>

              <Field label={ar ? "المحتوى (عربي)" : "Body (AR)"}>
                <textarea
                  value={editing.body_ar}
                  onChange={(e) => setEditing({ ...editing, body_ar: e.target.value })}
                  rows={6}
                  dir="rtl"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label={ar ? "المحتوى (إنجليزي)" : "Body (EN)"}>
                <textarea
                  value={editing.body_en}
                  onChange={(e) => setEditing({ ...editing, body_en: e.target.value })}
                  rows={6}
                  dir="ltr"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <details className="rounded-md border border-border bg-background/50">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                  {ar ? "إعدادات SEO (اختياري)" : "SEO settings (optional)"}
                </summary>
                <div className="space-y-3 border-t border-border p-3">
                  <Field label={ar ? "وصف SEO (عربي)" : "Meta description (AR)"}>
                    <input
                      value={editing.meta_description_ar ?? ""}
                      onChange={(e) => setEditing({ ...editing, meta_description_ar: e.target.value })}
                      maxLength={160}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label={ar ? "وصف SEO (إنجليزي)" : "Meta description (EN)"}>
                    <input
                      value={editing.meta_description_en ?? ""}
                      onChange={(e) => setEditing({ ...editing, meta_description_en: e.target.value })}
                      maxLength={160}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
              </details>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.is_published}
                    onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  />
                  {ar ? "منشور" : "Published"}
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.show_in_footer}
                    onChange={(e) => setEditing({ ...editing, show_in_footer: e.target.checked })}
                  />
                  {ar ? "في الفوتر" : "Show in footer"}
                </label>
                <Field label={ar ? "الترتيب" : "Sort"}>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
              <button
                onClick={() => !saving && setEditing(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={save}
                disabled={saving || !editing.slug || !editing.title_ar}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? (ar ? "جاري الحفظ…" : "Saving…") : (ar ? "حفظ" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
