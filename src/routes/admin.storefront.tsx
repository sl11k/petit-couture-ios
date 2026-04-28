import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Palette, Layout, LayoutGrid, History, Eye, EyeOff, Plus, Trash2,
  ArrowUp, ArrowDown, Save, RotateCcw, Image as ImageIcon, Type,
  Square, Layers, Settings as SettingsIcon, Calendar, AlertTriangle,
} from "lucide-react";
import {
  applyTheme, validateTheme, sanitizeHtml, saveRevision, SECTION_TYPES,
  type Theme,
} from "@/lib/theme";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/admin/storefront")({ component: StorefrontPage });

type Tab = "theme" | "pages" | "design_system" | "history";

function StorefrontPage() {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const canEdit = isAdmin || isManager;
  const [tab, setTab] = useState<Tab>("theme");

  if (roleLoading) {
    return <AdminShell><div className="p-8 text-sm text-muted-foreground">جاري التحميل...</div></AdminShell>;
  }
  if (!canEdit) {
    return (
      <AdminShell>
        <div className="m-6 rounded-lg border border-border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 text-lg font-semibold">غير مصرح</h2>
          <p className="mt-1 text-sm text-muted-foreground">تعديل الواجهات متاح للمسؤول والمدير فقط.</p>
        </div>
      </AdminShell>
    );
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "theme", label: "الثيم", icon: Palette },
    { key: "pages", label: "باني الصفحات", icon: Layout },
    { key: "design_system", label: "نظام التصميم", icon: Layers },
    { key: "history", label: "سجل التغييرات", icon: History },
  ];

  return (
    <AdminShell>
      <div className="space-y-4 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">واجهات الموقع</h1>
          <p className="text-sm text-muted-foreground">خصّص الثيم والصفحات بدون كود</p>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </nav>
        <section>
          {tab === "theme" && <ThemeTab />}
          {tab === "pages" && <PagesTab />}
          {tab === "design_system" && <DesignSystemTab />}
          {tab === "history" && <HistoryTab />}
        </section>
      </div>
    </AdminShell>
  );
}

// ────────── THEME ──────────
function ThemeTab() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [draft, setDraft] = useState<Theme | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("site_themes").select("*").eq("is_active", true).maybeSingle();
    if (data) { setTheme(data as any); setDraft(JSON.parse(JSON.stringify(data))); }
  })(); }, []);

  if (!draft) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  function update(path: string, value: any) {
    const next = JSON.parse(JSON.stringify(draft));
    const parts = path.split(".");
    let obj: any = next;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] = obj[parts[i]] ?? {};
    obj[parts[parts.length - 1]] = value;
    setDraft(next);
  }

  async function preview() {
    const errs = validateTheme(draft!);
    if (errs.length) { toast.error(errs[0]); return; }
    applyTheme(draft!);
    setPreviewing(true);
    toast.success("تم تطبيق المعاينة (لم يُنشر بعد)");
  }

  async function save() {
    if (!draft) return;
    const errs = validateTheme(draft);
    if (errs.length) { toast.error(errs[0]); return; }
    setSaving(true);
    if (theme) await saveRevision("theme", theme.id, theme, "حفظ تلقائي قبل التعديل");
    const d = draft;
    const { error } = await supabase.from("site_themes")
      .update({
        colors: d.colors, fonts: d.fonts, branding: d.branding,
        components: d.components, tokens: d.tokens,
      })
      .eq("id", d.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم نشر الثيم"); setTheme(d); applyTheme(d); }
  }

  function resetPreview() {
    if (theme) { applyTheme(theme); setPreviewing(false); toast.info("تمت العودة للثيم المنشور"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {previewing ? "وضع المعاينة — التغييرات غير منشورة" : "اضغط معاينة لرؤية التأثير قبل النشر"}
        </div>
        <div className="flex gap-2">
          {previewing && (
            <button onClick={resetPreview} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
              <RotateCcw className="h-3.5 w-3.5" />إلغاء المعاينة
            </button>
          )}
          <button onClick={preview} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
            <Eye className="h-3.5 w-3.5" />معاينة
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
            <Save className="h-3.5 w-3.5" />{saving ? "جاري..." : "نشر"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Colors */}
        <Section title="الألوان" icon={Palette}>
          <p className="mb-2 text-[11px] text-muted-foreground">صيغة HSL: مثال "30 50% 45%"</p>
          {Object.entries(draft.colors).map(([key, val]) => (
            <Field key={key} label={key.replace(/_/g, " ")}>
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded border border-border" style={{ background: `hsl(${val})` }} />
                <input value={val as string} onChange={(e) => update(`colors.${key}`, e.target.value)} className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs font-mono" />
              </div>
            </Field>
          ))}
        </Section>

        {/* Fonts */}
        <Section title="الخطوط" icon={Type}>
          <Field label="Sans (إنجليزي)">
            <input value={draft.fonts.sans ?? ""} onChange={(e) => update("fonts.sans", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          </Field>
          <Field label="Serif">
            <input value={draft.fonts.serif ?? ""} onChange={(e) => update("fonts.serif", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          </Field>
          <Field label="Arabic">
            <input value={draft.fonts.arabic ?? ""} onChange={(e) => update("fonts.arabic", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          </Field>
        </Section>

        {/* Branding */}
        <Section title="العلامة التجارية" icon={ImageIcon}>
          <Field label="اسم الموقع">
            <input value={draft.branding.site_name ?? ""} onChange={(e) => update("branding.site_name", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          </Field>
          <Field label="رابط الشعار (Light)">
            <input value={draft.branding.logo_url ?? ""} onChange={(e) => update("branding.logo_url", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="https://..." />
          </Field>
          <Field label="رابط الشعار (Dark)">
            <input value={draft.branding.logo_dark_url ?? ""} onChange={(e) => update("branding.logo_dark_url", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="https://..." />
          </Field>
          <Field label="Favicon">
            <input value={draft.branding.favicon_url ?? ""} onChange={(e) => update("branding.favicon_url", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" placeholder="https://..." />
          </Field>
        </Section>

        {/* Components */}
        <Section title="شكل المكونات" icon={Square}>
          <Field label="نصف قطر الزر">
            <input value={draft.components.button_radius ?? "0.5rem"} onChange={(e) => update("components.button_radius", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          </Field>
          <Field label="نمط الزر">
            <select value={draft.components.button_style ?? "filled"} onChange={(e) => update("components.button_style", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="filled">معبأ</option><option value="outline">حدود</option><option value="soft">ناعم</option>
            </select>
          </Field>
          <Field label="نصف قطر الكرت">
            <input value={draft.components.card_radius ?? "0.75rem"} onChange={(e) => update("components.card_radius", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
          </Field>
          <Field label="نمط الكرت">
            <select value={draft.components.card_style ?? "elevated"} onChange={(e) => update("components.card_style", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="elevated">مرفوع</option><option value="flat">مسطح</option><option value="outlined">مخطط</option>
            </select>
          </Field>
          <Field label="شكل الهيدر">
            <select value={draft.components.header_style ?? "solid"} onChange={(e) => update("components.header_style", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="solid">صلب</option><option value="transparent">شفاف</option><option value="minimal">بسيط</option>
            </select>
          </Field>
          <Field label="هيدر ثابت">
            <input type="checkbox" checked={!!draft.components.header_sticky} onChange={(e) => update("components.header_sticky", e.target.checked)} />
          </Field>
          <Field label="شكل الفوتر">
            <select value={draft.components.footer_style ?? "rich"} onChange={(e) => update("components.footer_style", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="rich">غني</option><option value="minimal">بسيط</option><option value="centered">في الوسط</option>
            </select>
          </Field>
          <Field label="Layout الصفحة الرئيسية">
            <select value={draft.components.home_layout ?? "classic"} onChange={(e) => update("components.home_layout", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs">
              <option value="classic">كلاسيكي</option><option value="magazine">مجلة</option><option value="boutique">بوتيك</option>
            </select>
          </Field>
        </Section>
      </div>
    </div>
  );
}

// ────────── PAGES BUILDER ──────────
function PagesTab() {
  const [pages, setPages] = useState<any[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function loadPages() {
    const { data } = await supabase.from("site_pages").select("*").order("created_at");
    setPages(data ?? []);
    if (!pageId && data?.[0]) setPageId(data[0].id);
  }
  async function loadSections() {
    if (!pageId) return;
    const { data } = await supabase.from("site_sections").select("*").eq("page_id", pageId).order("display_order");
    setSections(data ?? []);
  }

  useEffect(() => { loadPages(); }, []);
  useEffect(() => { loadSections(); }, [pageId]);

  async function addSection(type: string) {
    if (!pageId) return;
    const { error } = await supabase.from("site_sections").insert({
      page_id: pageId, section_type: type, display_order: sections.length,
      config: defaultConfig(type),
    });
    if (error) toast.error(error.message); else { toast.success("أُضيف القسم"); loadSections(); }
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = sections.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sections.length) return;
    const a = sections[idx], b = sections[swap];
    await Promise.all([
      supabase.from("site_sections").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("site_sections").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    loadSections();
  }
  async function toggleVisible(s: any) {
    await supabase.from("site_sections").update({ is_visible: !s.is_visible }).eq("id", s.id);
    loadSections();
  }
  async function remove(id: string) {
    if (!confirm("حذف القسم؟")) return;
    await supabase.from("site_sections").delete().eq("id", id);
    loadSections();
  }
  async function addPage() {
    const slug = prompt("slug للصفحة (مثل: spring-sale):");
    if (!slug) return;
    const title = prompt("عنوان الصفحة:") ?? slug;
    const { error } = await supabase.from("site_pages").insert({ slug, title_ar: title, is_landing: true });
    if (error) toast.error(error.message); else { toast.success("تم إنشاء الصفحة"); loadPages(); }
  }

  const currentPage = pages.find((p) => p.id === pageId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <select value={pageId ?? ""} onChange={(e) => setPageId(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm">
            {pages.map((p) => <option key={p.id} value={p.id}>{p.title_ar} ({p.slug})</option>)}
          </select>
          <button onClick={addPage} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
            <Plus className="h-3 w-3" />صفحة جديدة (Landing)
          </button>
        </div>
        {currentPage && (
          <button
            onClick={async () => {
              await supabase.from("site_pages").update({ is_published: !currentPage.is_published }).eq("id", currentPage.id);
              loadPages();
            }}
            className={`rounded px-2 py-1 text-xs ${currentPage.is_published ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
            {currentPage.is_published ? "منشورة" : "مسودة"}
          </button>
        )}
      </div>

      {/* Add section toolbar */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs font-medium text-foreground">إضافة قسم</p>
        <div className="flex flex-wrap gap-1.5">
          {SECTION_TYPES.map((t) => (
            <button key={t.key} onClick={() => addSection(t.key)} className="rounded border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
              <Plus className="me-1 inline h-3 w-3" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections list */}
      <div className="space-y-2">
        {sections.length === 0 && <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">لا توجد أقسام بعد</p>}
        {sections.map((s, i) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">#{i + 1}</span>
                <span className="text-sm font-medium text-foreground">
                  {SECTION_TYPES.find((t) => t.key === s.section_type)?.label ?? s.section_type}
                </span>
                {!s.is_visible && <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">مخفي</span>}
                {(s.starts_at || s.ends_at) && <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700"><Calendar className="h-3 w-3" />مجدول</span>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(s.id, -1)} disabled={i === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(s.id, 1)} disabled={i === sections.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => toggleVisible(s)} className="rounded p-1 hover:bg-muted">
                  {s.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setEditing(s)} className="rounded p-1 hover:bg-muted"><SettingsIcon className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(s.id)} className="rounded p-1 text-red-600 hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <SectionEditor section={editing} onClose={() => { setEditing(null); loadSections(); }} />}
    </div>
  );
}

function defaultConfig(type: string): any {
  switch (type) {
    case "hero": return { title: "عنوان جذاب", subtitle: "نص فرعي", cta_label: "تسوّق الآن", cta_href: "/products", image_url: "" };
    case "slider": return { slides: [{ title: "شريحة 1", image_url: "", href: "/" }] };
    case "categories_grid": return { title: "الأقسام", category_ids: [] };
    case "featured_products":
    case "best_sellers": return { title: "منتجات", product_ids: [], limit: 8 };
    case "offers": return { title: "العروض", coupon_codes: [] };
    case "testimonials": return { items: [{ name: "عميل", text: "تجربة ممتازة" }] };
    case "brand_logos": return { logos: [] };
    case "faq": return { faq_category: "general" };
    case "newsletter": return { title: "اشترك", placeholder: "بريدك الإلكتروني" };
    case "custom_html": return { html: "<p>نص HTML آمن</p>" };
    default: return {};
  }
}

function SectionEditor({ section, onClose }: { section: any; onClose: () => void }) {
  const [config, setConfig] = useState<any>(section.config ?? {});
  const [startsAt, setStartsAt] = useState<string>(section.starts_at ?? "");
  const [endsAt, setEndsAt] = useState<string>(section.ends_at ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    let finalConfig = config;
    if (section.section_type === "custom_html" && typeof config.html === "string") {
      finalConfig = { ...config, html: sanitizeHtml(config.html) };
    }
    await saveRevision("section", section.id, section, "تعديل قسم");
    const { error } = await supabase.from("site_sections")
      .update({ config: finalConfig, starts_at: startsAt || null, ends_at: endsAt || null })
      .eq("id", section.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("تم الحفظ"); onClose(); }
  }

  function setField(k: string, v: any) { setConfig({ ...config, [k]: v }); }
  const t = section.section_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold">تعديل {SECTION_TYPES.find((x) => x.key === t)?.label}</h3>
        <div className="space-y-3">
          {(t === "hero") && (
            <>
              <Field label="العنوان"><input value={config.title ?? ""} onChange={(e) => setField("title", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="النص الفرعي"><input value={config.subtitle ?? ""} onChange={(e) => setField("subtitle", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="نص الزر"><input value={config.cta_label ?? ""} onChange={(e) => setField("cta_label", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="رابط الزر"><input value={config.cta_href ?? ""} onChange={(e) => setField("cta_href", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="رابط الصورة"><input value={config.image_url ?? ""} onChange={(e) => setField("image_url", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
            </>
          )}
          {(t === "featured_products" || t === "best_sellers") && (
            <>
              <Field label="العنوان"><input value={config.title ?? ""} onChange={(e) => setField("title", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="معرّفات المنتجات (مفصولة بفواصل)">
                <input value={(config.product_ids ?? []).join(",")} onChange={(e) => setField("product_ids", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
              </Field>
              <Field label="الحد"><input type="number" value={config.limit ?? 8} onChange={(e) => setField("limit", Number(e.target.value))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
            </>
          )}
          {t === "categories_grid" && (
            <>
              <Field label="العنوان"><input value={config.title ?? ""} onChange={(e) => setField("title", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="معرّفات الأقسام (مفصولة بفواصل)">
                <input value={(config.category_ids ?? []).join(",")} onChange={(e) => setField("category_ids", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
              </Field>
            </>
          )}
          {t === "newsletter" && (
            <>
              <Field label="العنوان"><input value={config.title ?? ""} onChange={(e) => setField("title", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
              <Field label="نص الإدخال"><input value={config.placeholder ?? ""} onChange={(e) => setField("placeholder", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
            </>
          )}
          {t === "custom_html" && (
            <Field label="HTML (سيتم تنقيحه تلقائيًا)">
              <textarea value={config.html ?? ""} onChange={(e) => setField("html", e.target.value)} rows={8} className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono" />
              <p className="mt-1 text-[10px] text-muted-foreground">يُسمح فقط بوسوم آمنة. سيُحذف JavaScript وأي محتوى خطر.</p>
            </Field>
          )}
          {t === "faq" && (
            <Field label="فئة الأسئلة">
              <input value={config.faq_category ?? "general"} onChange={(e) => setField("faq_category", e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
            </Field>
          )}
          {(t === "slider" || t === "testimonials" || t === "brand_logos" || t === "offers") && (
            <Field label="بيانات JSON">
              <textarea value={JSON.stringify(config, null, 2)} onChange={(e) => { try { setConfig(JSON.parse(e.target.value)); } catch { /* keep typing */ } }}
                rows={8} className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono" />
            </Field>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <Field label="جدولة من"><input type="datetime-local" value={startsAt?.slice(0, 16) ?? ""} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
            <Field label="جدولة إلى"><input type="datetime-local" value={endsAt?.slice(0, 16) ?? ""} onChange={(e) => setEndsAt(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1 text-xs" /></Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">إلغاء</button>
          <button onClick={save} disabled={saving} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
            {saving ? "جاري..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── DESIGN SYSTEM ──────────
function DesignSystemTab() {
  return (
    <div className="space-y-4">
      <Section title="الألوان" icon={Palette}>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {["primary", "secondary", "accent", "muted", "background", "foreground", "border", "destructive"].map((k) => (
            <div key={k} className="rounded-md border border-border p-2 text-center">
              <div className="h-12 rounded" style={{ background: `hsl(var(--${k}))` }} />
              <p className="mt-1 text-[10px] text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Typography" icon={Type}>
        <div className="space-y-1">
          <p className="text-3xl font-bold">عنوان كبير 3xl</p>
          <p className="text-2xl font-semibold">عنوان 2xl</p>
          <p className="text-xl font-semibold">عنوان xl</p>
          <p className="text-base">نص أساسي</p>
          <p className="text-sm text-muted-foreground">نص ثانوي</p>
          <p className="text-xs text-muted-foreground">نص صغير</p>
        </div>
      </Section>
      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Primary</button>
          <button className="rounded-md border border-border bg-card px-4 py-2 text-sm">Outline</button>
          <button className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground">Secondary</button>
          <button className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground">Destructive</button>
          <button className="rounded-md px-4 py-2 text-sm hover:bg-muted">Ghost</button>
        </div>
      </Section>
      <Section title="Inputs">
        <div className="grid gap-2 md:grid-cols-2">
          <input placeholder="نص" className="rounded border border-border bg-background px-3 py-2 text-sm" />
          <select className="rounded border border-border bg-background px-3 py-2 text-sm"><option>اختر</option></select>
          <textarea placeholder="نص متعدد الأسطر" className="rounded border border-border bg-background px-3 py-2 text-sm md:col-span-2" />
        </div>
      </Section>
      <Section title="Cards">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">كرت مرفوع</div>
          <div className="rounded-lg border border-border bg-card p-4">كرت مسطح</div>
          <div className="rounded-lg border-2 border-primary bg-card p-4">كرت مخطط</div>
        </div>
      </Section>
      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">primary</span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">success</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">warning</span>
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700">error</span>
        </div>
      </Section>
      <Section title="Alerts">
        <div className="space-y-2">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">تنبيه نجاح</div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">تنبيه تحذير</div>
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800">تنبيه خطأ</div>
        </div>
      </Section>
      <Section title="Empty / Loading / Error States">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <LayoutGrid className="mx-auto mb-2 h-6 w-6" />لا توجد بيانات
          </div>
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />جاري التحميل
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center text-sm text-red-700">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />حدث خطأ
          </div>
        </div>
      </Section>
    </div>
  );
}

// ────────── HISTORY ──────────
function HistoryTab() {
  const [revs, setRevs] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "theme" | "page" | "section">("all");
  async function load() {
    let q = supabase.from("site_revisions").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") q = q.eq("entity_type", filter);
    const { data } = await q;
    setRevs(data ?? []);
  }
  useEffect(() => { load(); }, [filter]);

  async function restore(r: any) {
    if (!confirm("استعادة هذا الإصدار سيستبدل النسخة الحالية. متابعة؟")) return;
    const table = r.entity_type === "theme" ? "site_themes"
      : r.entity_type === "page" ? "site_pages" : "site_sections";
    const snap = r.snapshot;
    const { id, created_at, updated_at, ...rest } = snap;
    const { error } = await supabase.from(table).update(rest).eq("id", r.entity_id);
    if (error) toast.error(error.message); else toast.success("تمت الاستعادة");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="rounded border border-border bg-background px-2 py-1 text-sm">
          <option value="all">الكل</option><option value="theme">ثيم</option><option value="page">صفحة</option><option value="section">قسم</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-2 text-right">التاريخ</th>
            <th className="px-3 py-2 text-right">النوع</th>
            <th className="px-3 py-2 text-right">المعرّف</th>
            <th className="px-3 py-2 text-right">بواسطة</th>
            <th className="px-3 py-2 text-right">ملاحظة</th>
            <th className="px-3 py-2 text-right">إجراء</th>
          </tr></thead>
          <tbody>
            {revs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>}
            {revs.map((r) => (
              <tr key={r.id} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                <td className="px-3 py-2">{r.entity_type}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{r.entity_id.slice(0, 8)}…</td>
                <td className="px-3 py-2">{r.created_by_email ?? "—"}</td>
                <td className="px-3 py-2">{r.note ?? "—"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => restore(r)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted">
                    <RotateCcw className="h-3 w-3" />استعادة
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────── shared ──────────
function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 p-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
