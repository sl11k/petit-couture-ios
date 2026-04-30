import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye, EyeOff, Search, X, ExternalLink, Rocket } from "lucide-react";
import { AdminShell } from "@/components/AdminLayout";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { CollectionIOSPreview } from "@/components/admin/CollectionIOSPreview";

export const Route = createFileRoute("/admin/landing-pages")({
  component: LandingPagesAdmin,
});

type SortMode = "manual" | "newest" | "best_sellers" | "price_asc" | "price_desc";

type LandingPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  hero_image: string | null;
  cta_text: string | null;
  cta_url: string | null;
  product_ids: string[];
  coupon_code: string | null;
  is_active: boolean;
  show_as_collection: boolean;
  sort_mode: SortMode;
  position: number;
  views: number;
};

type ProductLite = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  sku: string | null;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
};

const EMPTY: Omit<LandingPage, "id" | "views"> = {
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  hero_image: "",
  cta_text: "",
  cta_url: "",
  product_ids: [],
  coupon_code: "",
  is_active: true,
  show_as_collection: false,
  sort_mode: "manual",
  position: 0,
};

function LandingPagesAdmin() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setPages((data ?? []) as LandingPage[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function togglePublish(p: LandingPage) {
    const { error } = await supabase
      .from("landing_pages")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم التحديث" : "Updated"); load(); }
  }

  async function remove(p: LandingPage) {
    if (!confirm(ar ? `حذف "${p.title}"؟` : `Delete "${p.title}"?`)) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(ar ? "تم الحذف" : "Deleted"); load(); }
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {ar ? "الصفحات المخصصة والمجموعات" : "Custom pages & collections"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "أنشئ صفحات هبوط أو مجموعات منتجات منتقاة يدوياً، واختر منتجاتها وترتيبها."
                : "Create landing pages or curated product collections — pick products and ordering."}
            </p>
          </div>
          <button
            onClick={() => { setEditing({ ...EMPTY, id: "", views: 0 } as LandingPage); setCreating(true); }}
            className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 h-10 text-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> {ar ? "صفحة جديدة" : "New page"}
          </button>
        </header>

        {loading ? (
          <div className="text-sm text-muted-foreground">{ar ? "جارِ التحميل..." : "Loading..."}</div>
        ) : pages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {ar ? "لا توجد صفحات بعد. أنشئ أول صفحة." : "No pages yet. Create your first one."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <article key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                {p.hero_image && (
                  <img src={p.hero_image} alt={p.title} className="w-full aspect-[16/9] object-cover rounded-md" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">/{p.show_as_collection ? "collection" : "landing"}/{p.slug}</p>
                  </div>
                  <span className={[
                    "shrink-0 text-[10px] px-2 h-5 inline-flex items-center rounded-full",
                    p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {p.is_active ? (ar ? "منشور" : "Live") : (ar ? "مسودة" : "Draft")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{p.product_ids.length} {ar ? "منتج" : "products"}</span>
                  <span>·</span>
                  <span>{p.views} {ar ? "مشاهدة" : "views"}</span>
                  {p.show_as_collection && <><span>·</span><span className="text-gold-deep">{ar ? "مجموعة" : "Collection"}</span></>}
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                  <button
                    onClick={() => { setEditing(p); setCreating(false); }}
                    className="flex-1 h-8 text-xs rounded-md border border-border hover:bg-cream-warm"
                  >
                    {ar ? "تعديل" : "Edit"}
                  </button>
                  <button
                    onClick={() => togglePublish(p)}
                    className="h-8 w-8 grid place-items-center rounded-md border border-border hover:bg-cream-warm"
                    aria-label={p.is_active ? "Hide" : "Show"}
                  >
                    {p.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={`/${p.show_as_collection ? "collection" : "landing"}/${p.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="h-8 w-8 grid place-items-center rounded-md border border-border hover:bg-cream-warm"
                    aria-label="Preview"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => remove(p)}
                    className="h-8 w-8 grid place-items-center rounded-md border border-border text-destructive hover:bg-destructive/10"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <PageEditor
          page={editing}
          isNew={creating}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </AdminShell>
  );
}

/* ---------------- Editor drawer ---------------- */

function PageEditor({
  page, isNew, onClose, onSaved,
}: {
  page: LandingPage;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [form, setForm] = useState<LandingPage>(page);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  // Selected products details (for display)
  const [selected, setSelected] = useState<ProductLite[]>([]);

  useEffect(() => {
    if (form.product_ids.length === 0) { setSelected([]); return; }
    supabase.from("products")
      .select("id, name_ar, name_en, sku, price, image_url, is_active")
      .in("id", form.product_ids)
      .then(({ data }) => {
        const map = new Map((data ?? []).map((p) => [p.id, p as ProductLite]));
        // Preserve order from product_ids
        setSelected(form.product_ids.map((id) => map.get(id)).filter(Boolean) as ProductLite[]);
      });
  }, [form.product_ids]);

  function update<K extends keyof LandingPage>(k: K, v: LandingPage[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(opts?: { publish?: boolean }) {
    if (!form.slug.trim() || !form.title.trim()) {
      toast.error(ar ? "العنوان والـ slug مطلوبان" : "Title and slug are required");
      return;
    }
    setSaving(true);
    const willPublish = opts?.publish ?? form.is_active;
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle || null,
      description: form.description || null,
      hero_image: form.hero_image || null,
      cta_text: form.cta_text || null,
      cta_url: form.cta_url || null,
      product_ids: form.product_ids,
      coupon_code: form.coupon_code || null,
      is_active: willPublish,
      show_as_collection: form.show_as_collection,
      sort_mode: form.sort_mode,
      position: form.position,
    };
    const q = isNew
      ? supabase.from("landing_pages").insert(payload)
      : supabase.from("landing_pages").update(payload).eq("id", form.id);
    const { error } = await q;
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      if (opts?.publish !== undefined) update("is_active", willPublish);
      toast.success(
        willPublish
          ? (ar ? "تم الحفظ والنشر — التغييرات ظاهرة الآن" : "Saved & published — changes are live")
          : (ar ? "تم حفظ المسودة" : "Draft saved")
      );
      onSaved();
    }
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= form.product_ids.length) return;
    const arr = [...form.product_ids];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    update("product_ids", arr);
  }

  function removeItem(id: string) {
    update("product_ids", form.product_ids.filter((x) => x !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button className="flex-1 bg-black/40" onClick={onClose} aria-label="Close" />
      <div className="w-full max-w-5xl bg-background overflow-y-auto border-s border-border">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 h-14 flex items-center justify-between">
          <h2 className="font-medium">{isNew ? (ar ? "صفحة جديدة" : "New page") : (ar ? "تعديل الصفحة" : "Edit page")}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-cream-warm">
              {ar ? "إلغاء" : "Cancel"}
            </button>
            <button onClick={() => save({ publish: false })} disabled={saving}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border text-sm hover:bg-cream-warm disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {ar ? "حفظ كمسودة" : "Save draft"}
            </button>
            <button onClick={() => save({ publish: true })} disabled={saving}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-foreground text-background text-sm disabled:opacity-50">
              <Rocket className="h-3.5 w-3.5" /> {saving ? "..." : (ar ? "حفظ ونشر" : "Save & publish")}
            </button>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_360px] gap-0">
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "العنوان" : "Title"}>
              <input value={form.title} onChange={(e) => update("title", e.target.value)} className="input" />
            </Field>
            <Field label="Slug (URL)">
              <input
                value={form.slug}
                onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="input font-mono text-sm"
                placeholder="summer-sale"
              />
            </Field>
          </div>

          <Field label={ar ? "العنوان الفرعي" : "Subtitle"}>
            <input value={form.subtitle ?? ""} onChange={(e) => update("subtitle", e.target.value)} className="input" />
          </Field>

          <Field label={ar ? "الوصف" : "Description"}>
            <textarea value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={3} className="input" />
          </Field>

          <Field label={ar ? "صورة الغلاف (URL)" : "Hero image (URL)"}>
            <input value={form.hero_image ?? ""} onChange={(e) => update("hero_image", e.target.value)} className="input" placeholder="https://..." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "نص زر CTA" : "CTA text"}>
              <input value={form.cta_text ?? ""} onChange={(e) => update("cta_text", e.target.value)} className="input" />
            </Field>
            <Field label={ar ? "رابط CTA" : "CTA URL"}>
              <input value={form.cta_url ?? ""} onChange={(e) => update("cta_url", e.target.value)} className="input" placeholder="/category/dresses" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={ar ? "كود كوبون" : "Coupon code"}>
              <input value={form.coupon_code ?? ""} onChange={(e) => update("coupon_code", e.target.value.toUpperCase())} className="input font-mono text-sm" />
            </Field>
            <Field label={ar ? "ترتيب الظهور" : "Position"}>
              <input type="number" value={form.position} onChange={(e) => update("position", Number(e.target.value) || 0)} className="input" />
            </Field>
          </div>

          {/* Toggles */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <Toggle
              label={ar ? "نشر الصفحة" : "Published"}
              hint={ar ? "ظاهر للزوار" : "Visible to visitors"}
              value={form.is_active}
              onChange={(v) => update("is_active", v)}
            />
            <Toggle
              label={ar ? "عرض كمجموعة داخل البوتيك" : "Show as collection in boutique"}
              hint={ar ? "ستظهر في صفحات المتجر كقسم" : "Will appear in storefront sections"}
              value={form.show_as_collection}
              onChange={(v) => update("show_as_collection", v)}
            />
          </div>

          {/* Sort mode */}
          <Field label={ar ? "ترتيب المنتجات" : "Products ordering"}>
            <select
              value={form.sort_mode}
              onChange={(e) => update("sort_mode", e.target.value as SortMode)}
              className="input"
            >
              <option value="manual">{ar ? "يدوي (ترتيب الاختيار)" : "Manual (selection order)"}</option>
              <option value="newest">{ar ? "الأحدث أولاً" : "Newest first"}</option>
              <option value="best_sellers">{ar ? "الأكثر مبيعاً" : "Best sellers"}</option>
              <option value="price_asc">{ar ? "السعر: الأقل أولاً" : "Price: low to high"}</option>
              <option value="price_desc">{ar ? "السعر: الأعلى أولاً" : "Price: high to low"}</option>
            </select>
          </Field>

          {/* Products picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {ar ? "المنتجات" : "Products"} ({form.product_ids.length})
              </h3>
              <button
                onClick={() => setPicker(true)}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border text-xs hover:bg-cream-warm"
              >
                <Plus className="h-3.5 w-3.5" /> {ar ? "إضافة منتجات" : "Add products"}
              </button>
            </div>

            {selected.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                {ar ? "لم تختر أي منتجات بعد." : "No products selected yet."}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {selected.map((p, idx) => (
                  <li key={p.id} className="flex items-center gap-3 p-2.5">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveItem(idx, idx - 1)}
                        disabled={idx === 0 || form.sort_mode !== "manual"}
                        className="h-4 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >▲</button>
                      <button
                        onClick={() => moveItem(idx, idx + 1)}
                        disabled={idx === selected.length - 1 || form.sort_mode !== "manual"}
                        className="h-4 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >▼</button>
                    </div>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <div className="h-12 w-12 bg-muted rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.sku} · {p.price?.toFixed(2)} SAR
                        {!p.is_active && <span className="text-destructive ms-2">{ar ? "غير نشط" : "Inactive"}</span>}
                      </p>
                    </div>
                    <button onClick={() => removeItem(p.id)} className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {picker && (
        <ProductPicker
          excludedIds={form.product_ids}
          onAdd={(ids) => {
            update("product_ids", [...form.product_ids, ...ids.filter((id) => !form.product_ids.includes(id))]);
            setPicker(false);
          }}
          onClose={() => setPicker(false)}
        />
      )}

      <style>{`
        .input {
          width: 100%;
          height: 2.5rem;
          padding: 0 0.75rem;
          border: 1px solid hsl(var(--border, 0 0% 90%));
          border-radius: 0.375rem;
          background: var(--background);
          color: var(--foreground);
          font-size: 0.875rem;
          outline: none;
        }
        textarea.input { height: auto; padding: 0.5rem 0.75rem; }
        .input:focus { border-color: var(--gold, #c9a87a); }
      `}</style>
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

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span className="flex-1">
        <span className="text-sm text-foreground block">{label}</span>
        {hint && <span className="text-xs text-muted-foreground block mt-0.5">{hint}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={[
          "relative h-6 w-11 rounded-full transition shrink-0 mt-1",
          value ? "bg-foreground" : "bg-muted",
        ].join(" ")}
        aria-pressed={value}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
            value ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </label>
  );
}

/* ---------------- Product picker ---------------- */

function ProductPicker({
  excludedIds, onAdd, onClose,
}: {
  excludedIds: string[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("id, name_ar, name_en, sku, price, image_url, is_active")
        .order("created_at", { ascending: false })
        .limit(40);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`name_ar.ilike.${term},name_en.ilike.${term},sku.ilike.${term}`);
      }
      const { data } = await query;
      if (!alive) return;
      setResults((data ?? []) as ProductLite[]);
      setLoading(false);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-background rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col border border-border">
        <header className="px-5 h-14 border-b border-border flex items-center justify-between">
          <h2 className="font-medium text-sm">{ar ? "اختر المنتجات" : "Select products"} ({picked.size})</h2>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-cream-warm">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? "ابحث بالاسم أو SKU..." : "Search by name or SKU..."}
              className="w-full h-10 ps-10 pe-3 border border-border rounded-md bg-background text-sm outline-none focus:border-gold"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">{ar ? "جارِ البحث..." : "Searching..."}</p>
          ) : results.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{ar ? "لا توجد نتائج" : "No results"}</p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((p) => {
                const already = excludedIds.includes(p.id);
                const checked = picked.has(p.id);
                return (
                  <li key={p.id}>
                    <label className={[
                      "flex items-center gap-3 p-2.5 rounded-md cursor-pointer",
                      already ? "opacity-50 cursor-not-allowed" : "hover:bg-cream-warm",
                    ].join(" ")}>
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4"
                      />
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-12 w-12 object-cover rounded" />
                      ) : (
                        <div className="h-12 w-12 bg-muted rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.sku} · {p.price?.toFixed(2)} SAR
                          {already && <span className="ms-2">{ar ? "(مُضاف)" : "(already added)"}</span>}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="p-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-cream-warm">
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            onClick={() => onAdd([...picked])}
            disabled={picked.size === 0}
            className="h-9 px-4 rounded-md bg-foreground text-background text-sm disabled:opacity-50"
          >
            {ar ? `إضافة (${picked.size})` : `Add (${picked.size})`}
          </button>
        </footer>
      </div>
    </div>
  );
}
