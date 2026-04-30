import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  LifeBuoy, BookOpen, Video, HelpCircle, Search, Plus,
  Edit2, Trash2, X, Save, Mail, MessageCircle, ChevronRight,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/admin/help")({ component: HelpAdmin });

type Article = {
  id: string;
  category: "guide" | "video" | "faq";
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  video_url: string | null;
  external_url: string | null;
  sort_order: number;
  is_published: boolean;
  updated_at: string;
};

const EMPTY: Omit<Article, "id" | "updated_at"> = {
  category: "guide", title_ar: "", title_en: "", body_ar: "", body_en: "",
  video_url: null, external_url: null, sort_order: 0, is_published: true,
};

const CAT_META = {
  guide: { icon: BookOpen, labelAr: "دليل الاستخدام", labelEn: "User guide", tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  video: { icon: Video, labelAr: "فيديوهات", labelEn: "Videos", tone: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  faq: { icon: HelpCircle, labelAr: "أسئلة شائعة", labelEn: "FAQ", tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
} as const;

function HelpAdmin() {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";
  const { isSuperAdmin } = useUserRole();

  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | Article["category"]>("all");
  const [editing, setEditing] = useState<(Article | (typeof EMPTY & { id?: string })) | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("admin_help_articles")
      .select("*")
      .eq("is_published", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    setItems((data ?? []) as Article[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (catFilter !== "all" && a.category !== catFilter) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        return (
          a.title_ar.toLowerCase().includes(s) ||
          a.title_en.toLowerCase().includes(s) ||
          a.body_ar.toLowerCase().includes(s) ||
          a.body_en.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [items, q, catFilter]);

  const grouped = useMemo(() => {
    const g: Record<Article["category"], Article[]> = { guide: [], video: [], faq: [] };
    filtered.forEach((a) => g[a.category].push(a));
    return g;
  }, [filtered]);

  async function save() {
    if (!editing || !isSuperAdmin) return;
    setSaving(true);
    const payload = {
      category: editing.category,
      title_ar: editing.title_ar.trim(),
      title_en: editing.title_en.trim(),
      body_ar: editing.body_ar,
      body_en: editing.body_en,
      video_url: editing.video_url,
      external_url: editing.external_url,
      sort_order: editing.sort_order,
      is_published: editing.is_published,
    };
    let error;
    if ("id" in editing && editing.id) {
      ({ error } = await supabase.from("admin_help_articles").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("admin_help_articles").insert(payload));
    }
    setSaving(false);
    if (error) { flash(error.message); return; }
    flash(ar ? "تم الحفظ" : "Saved");
    setEditing(null);
    void load();
  }

  async function remove(a: Article) {
    if (!isSuperAdmin) return;
    if (!confirm(ar ? `حذف "${a.title_ar}"؟` : `Delete "${a.title_en}"?`)) return;
    await supabase.from("admin_help_articles").delete().eq("id", a.id);
    void load();
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Hero */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {ar ? "مركز المساعدة" : "Help center"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ar
                    ? "أدلة استخدام، فيديوهات تعليمية، وأجوبة الأسئلة الشائعة لفريق الإدارة."
                    : "Guides, video tutorials, and FAQ for the admin team."}
                </p>
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => setEditing({ ...EMPTY })}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> {ar ? "مقال جديد" : "New article"}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mt-5">
            <div className="relative">
              <Search className={`pointer-events-none absolute ${isRTL ? "right-3" : "left-3"} top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "ابحث في المساعدة…" : "Search help…"}
                className={`w-full rounded-lg border border-border bg-background py-3 ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"} text-sm focus:outline-none focus:ring-2 focus:ring-primary/30`}
              />
            </div>
          </div>

          {/* Category quick filters */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setCatFilter("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${catFilter==="all" ? "bg-foreground text-background" : "bg-background text-muted-foreground border border-border hover:bg-muted"}`}
            >
              {ar ? "الكل" : "All"} ({items.length})
            </button>
            {(Object.keys(CAT_META) as Article["category"][]).map((k) => {
              const m = CAT_META[k];
              const Icon = m.icon;
              const count = items.filter((a) => a.category === k).length;
              return (
                <button
                  key={k}
                  onClick={() => setCatFilter(k)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${catFilter===k ? "bg-foreground text-background" : "bg-background text-muted-foreground border border-border hover:bg-muted"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ar ? m.labelAr : m.labelEn} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Articles by category */}
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {ar ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <HelpCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{ar ? "لا توجد نتائج." : "No results."}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(Object.keys(grouped) as Article["category"][]).map((cat) => {
              const list = grouped[cat];
              if (list.length === 0) return null;
              const m = CAT_META[cat];
              const Icon = m.icon;
              return (
                <section key={cat}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`grid h-7 w-7 place-items-center rounded-md ${m.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">{ar ? m.labelAr : m.labelEn}</h2>
                    <span className="text-xs text-muted-foreground">({list.length})</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {list.map((a) => {
                      const isOpen = opened === a.id;
                      return (
                        <div key={a.id} className="rounded-lg border border-border bg-card overflow-hidden">
                          <div className="flex items-start gap-2 p-3">
                            <button
                              onClick={() => setOpened(isOpen ? null : a.id)}
                              className={`flex-1 ${isRTL ? "text-right" : "text-left"} min-w-0`}
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : isRTL ? "rotate-180" : ""}`} />
                                <span className="font-medium text-foreground">{ar ? a.title_ar : a.title_en}</span>
                              </div>
                            </button>
                            {isSuperAdmin && (
                              <div className="flex shrink-0 gap-1">
                                <button onClick={() => setEditing(a)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title={ar ? "تعديل" : "Edit"}>
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button onClick={() => remove(a)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title={ar ? "حذف" : "Delete"}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {isOpen && (
                            <div className="border-t border-border bg-muted/20 p-4">
                              <p className="whitespace-pre-wrap text-sm text-foreground/90">{ar ? a.body_ar : a.body_en}</p>
                              {a.video_url && (
                                <a href={a.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                                  <Video className="h-3.5 w-3.5" />
                                  {ar ? "مشاهدة الفيديو" : "Watch video"}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {a.external_url && (
                                <a href={a.external_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                                  {ar ? "المصدر" : "Source"}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Contact support */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">
            {ar ? "ما زلت تحتاج مساعدة؟" : "Still need help?"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {ar ? "تواصل مع فريق الدعم لأي استفسار." : "Reach out to the support team for any questions."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="mailto:support@lppme.com"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted"
            >
              <Mail className="h-3.5 w-3.5" /> support@lppme.com
            </a>
            <a
              href="https://lppme.com/help"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted"
            >
              <MessageCircle className="h-3.5 w-3.5" /> {ar ? "الموقع الرسمي" : "Official site"}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex" dir={isRTL ? "rtl" : "ltr"}>
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setEditing(null)} />
          <div className={`relative ml-auto h-full w-full max-w-2xl overflow-y-auto bg-card shadow-2xl ${isRTL ? "mr-auto ml-0" : ""}`}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
              <h3 className="text-base font-semibold">
                {"id" in editing && editing.id ? (ar ? "تعديل مقال" : "Edit article") : (ar ? "مقال جديد" : "New article")}
              </h3>
              <button onClick={() => !saving && setEditing(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <Field label={ar ? "الفئة" : "Category"}>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="guide">{ar ? "دليل" : "Guide"}</option>
                  <option value="video">{ar ? "فيديو" : "Video"}</option>
                  <option value="faq">FAQ</option>
                </select>
              </Field>

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

              <Field label={ar ? "المحتوى (عربي)" : "Body (AR)"}>
                <textarea
                  value={editing.body_ar}
                  onChange={(e) => setEditing({ ...editing, body_ar: e.target.value })}
                  rows={5}
                  dir="rtl"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label={ar ? "المحتوى (إنجليزي)" : "Body (EN)"}>
                <textarea
                  value={editing.body_en}
                  onChange={(e) => setEditing({ ...editing, body_en: e.target.value })}
                  rows={5}
                  dir="ltr"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              {editing.category === "video" && (
                <Field label={ar ? "رابط الفيديو" : "Video URL"}>
                  <input
                    value={editing.video_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
                    placeholder="https://youtube.com/..."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              )}

              <Field label={ar ? "رابط خارجي (اختياري)" : "External URL (optional)"}>
                <input
                  value={editing.external_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, external_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label={ar ? "الترتيب" : "Sort"}>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <label className="flex items-end gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.is_published}
                    onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  />
                  {ar ? "منشور" : "Published"}
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
              <button onClick={() => !saving && setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={save}
                disabled={saving || !editing.title_ar}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
