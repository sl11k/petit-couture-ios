import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, Eye, EyeOff, ArrowUp, ArrowDown,
  LayoutGrid, Image as ImageIcon, Star, Sparkles, FolderTree, Megaphone, Type, Layers,
} from "lucide-react";
import { AdminShell } from "@/components/AdminLayout";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchHomeSections,
  type HomeSection,
  type HomeSectionKind,
  type HomeSectionDataSource,
} from "@/lib/storefront";
import { categories as seedCategories } from "@/data/categories";

export const Route = createFileRoute("/admin/home-builder")({
  component: HomeBuilderPage,
});

const KIND_META: Record<HomeSectionKind, { ar: string; en: string; icon: typeof LayoutGrid; productBased: boolean }> = {
  hero:                { ar: "Hero (صورة كبيرة + CTA)",        en: "Hero",                icon: ImageIcon, productBased: false },
  banners:             { ar: "شبكة بانرات",                    en: "Banners grid",        icon: LayoutGrid, productBased: false },
  featured_categories: { ar: "تصنيفات مميزة",                  en: "Featured categories", icon: FolderTree, productBased: false },
  most_popular:        { ar: "الأكثر شعبية / Best Sellers",    en: "Most Popular",        icon: Star,       productBased: true  },
  new_arrivals:        { ar: "وصل حديثاً",                     en: "New Arrivals",        icon: Sparkles,   productBased: true  },
  custom_collection:   { ar: "مجموعة مخصصة",                   en: "Custom Collection",   icon: Layers,     productBased: true  },
  announcements:       { ar: "شريط الإعلانات",                 en: "Announcements bar",   icon: Megaphone,  productBased: false },
  rich_text:           { ar: "نص حر",                          en: "Rich text",           icon: Type,       productBased: false },
};

const DEFAULT_DATA_SOURCE: Record<HomeSectionKind, HomeSectionDataSource> = {
  hero: "auto", banners: "auto", featured_categories: "auto",
  most_popular: "best_sellers", new_arrivals: "newest",
  custom_collection: "collection", announcements: "auto", rich_text: "auto",
};

function HomeBuilderPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchHomeSections(false);
      setSections(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const a = sections[idx];
    const b = sections[target];
    // Swap positions
    await supabase.from("home_sections").update({ position: b.position }).eq("id", a.id);
    await supabase.from("home_sections").update({ position: a.position }).eq("id", b.id);
    load();
  }

  async function toggle(s: HomeSection) {
    const { error } = await supabase.from("home_sections").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  }

  async function remove(s: HomeSection) {
    if (!confirm(ar ? "حذف هذا القسم؟" : "Delete this section?")) return;
    const { error } = await supabase.from("home_sections").delete().eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success(ar ? "تم الحذف" : "Deleted"); load(); }
  }

  async function addNew(kind: HomeSectionKind) {
    const maxPos = sections.reduce((m, s) => Math.max(m, s.position), -1);
    const payload = {
      kind,
      data_source: DEFAULT_DATA_SOURCE[kind],
      position: maxPos + 1,
      is_active: true,
      product_ids: [] as string[],
      config: {},
      title_ar: KIND_META[kind].ar,
      title_en: KIND_META[kind].en,
    };
    const { data, error } = await supabase.from("home_sections").insert(payload).select("*").single();
    if (error) { toast.error(error.message); return; }
    setAdding(false);
    setEditing(data as HomeSection);
    load();
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {ar ? "بناء الصفحة الرئيسية" : "Home Page Builder"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "أضف أقساماً، رتّبها، وحدد مصدر بياناتها (تلقائي أو مجموعة مخصصة)."
                : "Add sections, reorder them, and pick each section's data source."}
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 h-10 text-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {ar ? "إضافة قسم" : "Add section"}
          </button>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">{ar ? "جارِ التحميل..." : "Loading..."}</p>
        ) : sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {ar
              ? "لا توجد أقسام بعد. أضف القسم الأول لبدء بناء الصفحة الرئيسية."
              : "No sections yet. Add your first section to start building the home page."}
            <div className="mt-4">
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border px-4 h-9 text-sm hover:bg-cream-warm"
              >
                <Plus className="h-4 w-4" /> {ar ? "إضافة قسم" : "Add section"}
              </button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {sections.map((s, idx) => {
              const meta = KIND_META[s.kind];
              const Icon = meta.icon;
              return (
                <li key={s.id} className="rounded-lg border border-border bg-card p-3 sm:p-4 flex items-center gap-3">
                  <div className="flex flex-col">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0}
                      className="h-6 w-6 grid place-items-center rounded hover:bg-cream-warm disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => move(idx, 1)} disabled={idx === sections.length - 1}
                      className="h-6 w-6 grid place-items-center rounded hover:bg-cream-warm disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="h-10 w-10 grid place-items-center rounded-md bg-cream-warm text-gold-deep shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {ar ? (s.title_ar || meta.ar) : (s.title_en || meta.en)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? meta.ar : meta.en}
                      {meta.productBased && (
                        <> · <span>{ar ? "المصدر: " : "Source: "}{labelForSource(s.data_source, ar)}</span></>
                      )}
                      {!s.is_active && <span className="text-destructive ms-2">· {ar ? "مخفي" : "Hidden"}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(s)}
                      className="h-8 px-3 text-xs rounded-md border border-border hover:bg-cream-warm">
                      {ar ? "تعديل" : "Edit"}
                    </button>
                    <button onClick={() => toggle(s)} aria-label="Toggle"
                      className="h-8 w-8 grid place-items-center rounded-md border border-border hover:bg-cream-warm">
                      {s.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => remove(s)} aria-label="Delete"
                      className="h-8 w-8 grid place-items-center rounded-md border border-border text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && (
        <SectionTypePicker
          onPick={addNew}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <SectionEditor
          section={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </AdminShell>
  );
}

function labelForSource(s: HomeSectionDataSource, ar: boolean) {
  const labels: Record<HomeSectionDataSource, [string, string]> = {
    auto:         ["تلقائي", "Auto"],
    best_sellers: ["الأكثر مبيعاً", "Best sellers"],
    newest:       ["الأحدث", "Newest"],
    category:     ["تصنيف", "Category"],
    collection:   ["مجموعة", "Collection"],
    manual:       ["اختيار يدوي", "Manual pick"],
  };
  return ar ? labels[s][0] : labels[s][1];
}

/* ---------------- Section type picker ---------------- */

function SectionTypePicker({ onPick, onClose }: { onPick: (k: HomeSectionKind) => void; onClose: () => void }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const kinds = Object.keys(KIND_META) as HomeSectionKind[];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-background rounded-lg border border-border w-full max-w-2xl">
        <header className="px-5 h-14 border-b border-border flex items-center justify-between">
          <h2 className="font-medium text-sm">{ar ? "اختر نوع القسم" : "Choose a section type"}</h2>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-cream-warm">×</button>
        </header>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {kinds.map((k) => {
            const m = KIND_META[k];
            const Icon = m.icon;
            return (
              <button
                key={k}
                onClick={() => onPick(k)}
                className="text-start rounded-lg border border-border p-3 hover:bg-cream-warm hover:border-gold transition"
              >
                <Icon className="h-5 w-5 text-gold-deep" />
                <p className="mt-2 text-sm font-medium text-foreground">{ar ? m.ar : m.en}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Section editor ---------------- */

function SectionEditor({
  section, onClose, onSaved,
}: { section: HomeSection; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [form, setForm] = useState<HomeSection>(section);
  const [saving, setSaving] = useState(false);
  const meta = KIND_META[form.kind];

  // Collections list (for `collection` source)
  const [collections, setCollections] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (form.kind === "custom_collection" || form.data_source === "collection") {
      supabase.from("landing_pages")
        .select("id, title")
        .order("created_at", { ascending: false })
        .then(({ data }) => setCollections((data ?? []) as { id: string; title: string }[]));
    }
  }, [form.kind, form.data_source]);

  function update<K extends keyof HomeSection>(k: K, v: HomeSection[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updateConfig(k: string, v: unknown) {
    setForm((f) => ({ ...f, config: { ...f.config, [k]: v } }));
  }

  async function save() {
    setSaving(true);
    const payload = {
      kind: form.kind,
      title_ar: form.title_ar || null,
      title_en: form.title_en || null,
      eyebrow_ar: form.eyebrow_ar || null,
      eyebrow_en: form.eyebrow_en || null,
      data_source: form.data_source,
      source_ref: form.source_ref || null,
      product_ids: form.product_ids ?? [],
      config: form.config ?? {},
      position: form.position,
      is_active: form.is_active,
    };
    const { error } = await supabase.from("home_sections").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم الحفظ" : "Saved"); onSaved(); }
  }

  // Source options depend on the kind
  const sourceOptions: HomeSectionDataSource[] = meta.productBased
    ? form.kind === "new_arrivals"
      ? ["newest", "best_sellers", "collection", "manual"]
      : form.kind === "custom_collection"
      ? ["collection", "manual"]
      : ["best_sellers", "newest", "category", "collection", "manual"]
    : ["auto"];

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button className="flex-1 bg-black/40" onClick={onClose} aria-label="Close" />
      <div className="w-full max-w-xl bg-background overflow-y-auto border-s border-border">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 h-14 flex items-center justify-between">
          <h2 className="font-medium">{ar ? "تعديل القسم" : "Edit section"} — {ar ? meta.ar : meta.en}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-cream-warm">
              {ar ? "إلغاء" : "Cancel"}
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-foreground text-background text-sm disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {saving ? "..." : (ar ? "حفظ" : "Save")}
            </button>
          </div>
        </header>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "العنوان (عربي)" : "Title (AR)"}>
              <input value={form.title_ar ?? ""} onChange={(e) => update("title_ar", e.target.value)} className="input" />
            </Field>
            <Field label={ar ? "العنوان (إنجليزي)" : "Title (EN)"}>
              <input value={form.title_en ?? ""} onChange={(e) => update("title_en", e.target.value)} className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "Eyebrow (عربي)" : "Eyebrow (AR)"}>
              <input value={form.eyebrow_ar ?? ""} onChange={(e) => update("eyebrow_ar", e.target.value)} className="input" />
            </Field>
            <Field label={ar ? "Eyebrow (إنجليزي)" : "Eyebrow (EN)"}>
              <input value={form.eyebrow_en ?? ""} onChange={(e) => update("eyebrow_en", e.target.value)} className="input" />
            </Field>
          </div>

          {meta.productBased && (
            <Field label={ar ? "مصدر المنتجات" : "Products data source"}>
              <select value={form.data_source} onChange={(e) => update("data_source", e.target.value as HomeSectionDataSource)} className="input">
                {sourceOptions.map((opt) => (
                  <option key={opt} value={opt}>{labelForSource(opt, ar)}</option>
                ))}
              </select>
            </Field>
          )}

          {form.data_source === "category" && (
            <Field label={ar ? "اختر التصنيف" : "Select category"}>
              <select value={form.source_ref ?? ""} onChange={(e) => update("source_ref", e.target.value)} className="input">
                <option value="">— {ar ? "اختر" : "select"} —</option>
                {seedCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </Field>
          )}

          {(form.data_source === "collection" || form.kind === "custom_collection") && (
            <Field label={ar ? "اختر المجموعة" : "Select collection"}>
              <select value={form.source_ref ?? ""} onChange={(e) => update("source_ref", e.target.value)} className="input">
                <option value="">— {ar ? "اختر" : "select"} —</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {ar ? "أنشئ المجموعات من «الصفحات والمجموعات»." : "Create collections in Pages & Collections."}
              </p>
            </Field>
          )}

          {meta.productBased && (
            <Field label={ar ? "عدد المنتجات للعرض" : "Products to show"}>
              <input
                type="number" min={1} max={50}
                value={Number((form.config as any)?.limit ?? 8)}
                onChange={(e) => updateConfig("limit", Number(e.target.value) || 8)}
                className="input"
              />
            </Field>
          )}

          {form.kind === "rich_text" && (
            <>
              <Field label={ar ? "النص (عربي)" : "Body (AR)"}>
                <textarea rows={4} value={String((form.config as any)?.body_ar ?? "")} onChange={(e) => updateConfig("body_ar", e.target.value)} className="input" />
              </Field>
              <Field label={ar ? "النص (إنجليزي)" : "Body (EN)"}>
                <textarea rows={4} value={String((form.config as any)?.body_en ?? "")} onChange={(e) => updateConfig("body_en", e.target.value)} className="input" />
              </Field>
            </>
          )}

          {(form.kind === "hero" || form.kind === "banners" || form.kind === "featured_categories" || form.kind === "announcements") && (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              {ar
                ? "هذا القسم يعرض البيانات القائمة من «إدارة الواجهة» (البانرات/التصنيفات/الإعلانات). أضف/عدّل المحتوى من هناك."
                : "This section pulls live data from Storefront management (banners/categories/announcements). Manage content there."}
            </div>
          )}

          <div className="rounded-lg border border-border p-4">
            <Toggle label={ar ? "نشط (ظاهر للزوار)" : "Active (visible to visitors)"} value={form.is_active} onChange={(v) => update("is_active", v)} />
          </div>
        </div>

        <style>{`
          .input{width:100%;height:2.5rem;padding:0 .75rem;border:1px solid hsl(var(--border, 0 0% 90%));border-radius:.375rem;background:var(--background);color:var(--foreground);font-size:.875rem;outline:none}
          textarea.input{height:auto;padding:.5rem .75rem}
          .input:focus{border-color:var(--gold,#c9a87a)}
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={["relative h-6 w-11 rounded-full transition shrink-0", value ? "bg-foreground" : "bg-muted"].join(" ")}
        aria-pressed={value}>
        <span className={["absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all", value ? "left-[22px]" : "left-0.5"].join(" ")} />
      </button>
    </label>
  );
}
