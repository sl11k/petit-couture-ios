import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useTr, type TrFn } from "@/i18n/tr";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronLeft,
  Image as ImageIcon, Package, Search, GripVertical, Pin, PinOff,
  ArrowUp, ArrowDown, Eye, EyeOff,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesAdmin,
});

type DisplayRules = {
  sort: "manual" | "newest" | "best_selling" | "price_asc" | "price_desc";
  filters: {
    price: boolean; color: boolean; size: boolean;
    brand: boolean; availability: boolean; rating: boolean;
  };
};

type Cat = {
  id: string;
  parent_id: string | null;
  name_ar: string;
  name_en: string;
  slug: string;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
  icon: string | null;
  description_ar: string | null;
  description_en: string | null;
  banner_url: string | null;
  banner_link: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  image_alt: string | null;
  display_rules: DisplayRules;
};

type Product = { id: string; name_ar: string; sku: string | null; image_url: string | null; price: number };
type LinkedProduct = Product & { display_order: number; is_pinned: boolean };

const defaultRules: DisplayRules = {
  sort: "manual",
  filters: { price: true, color: true, size: true, brand: true, availability: true, rating: true },
};

function CategoriesAdmin() {
  const tr = useTr();
  const { lang } = useLanguage();
  const { isAdmin, isManager } = useUserRole();
  const canDelete = isAdmin || isManager;

  const [list, setList] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"basic" | "media" | "seo" | "rules">("basic");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("display_order", { ascending: true });
    setList(((data ?? []) as any[]).map(normalizeCat));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const tree = useMemo(() => buildTree(list), [list]);

  async function save() {
    if (!editing?.name_ar || !editing?.slug) {
      alert(tr("الاسم العربي والـ slug مطلوبان", "Arabic name and slug are required"));
      return;
    }
    const payload: any = {
      parent_id: editing.parent_id || null,
      name_ar: editing.name_ar,
      name_en: editing.name_en ?? editing.name_ar,
      slug: editing.slug,
      display_order: editing.display_order ?? 0,
      is_active: editing.is_active ?? true,
      image_url: editing.image_url || null,
      icon: editing.icon || null,
      description_ar: editing.description_ar || null,
      description_en: editing.description_en || null,
      banner_url: editing.banner_url || null,
      banner_link: editing.banner_link || null,
      meta_title: editing.meta_title || null,
      meta_description: editing.meta_description || null,
      og_image: editing.og_image || null,
      image_alt: editing.image_alt || null,
      display_rules: editing.display_rules ?? defaultRules,
    };
    let entityId = editing.id;
    if (editing.id) {
      await supabase.from("categories").update(payload).eq("id", editing.id);
    } else {
      const { data } = await supabase.from("categories").insert(payload).select("id").single();
      entityId = data?.id;
    }
    const { data: u } = await supabase.auth.getUser();
    if (u.user && entityId) {
      await supabase.from("audit_logs").insert({
        actor_id: u.user.id, actor_email: u.user.email,
        action: editing.id ? "category.update" : "category.create",
        entity: "category", entity_id: entityId, metadata: { slug: payload.slug },
      });
    }
    setEditing(null);
    await load();
  }

  async function remove(c: Cat) {
    if (!canDelete) return alert(tr("لا تملك صلاحية الحذف", "You don't have delete permission"));
    if (!confirm(tr(`حذف القسم "${c.name_ar}"؟ سيتم فصل الأقسام الفرعية وروابط المنتجات.`, `Delete category "${c.name_en || c.name_ar}"? Subcategories and product links will be detached.`))) return;
    await supabase.from("categories").delete().eq("id", c.id);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("audit_logs").insert({
        actor_id: u.user.id, actor_email: u.user.email,
        action: "category.delete", entity: "category", entity_id: c.id,
        metadata: { name_ar: c.name_ar },
      });
    }
    await load();
  }

  async function toggleActive(c: Cat) {
    await supabase.from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    await load();
  }

  async function move(c: Cat, dir: -1 | 1) {
    const siblings = list.filter((x) => x.parent_id === c.parent_id).sort((a, b) => a.display_order - b.display_order);
    const i = siblings.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    const a = siblings[i], b = siblings[j];
    await supabase.from("categories").update({ display_order: b.display_order }).eq("id", a.id);
    await supabase.from("categories").update({ display_order: a.display_order }).eq("id", b.id);
    await load();
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tr("الأقسام", "Categories")}</h1>
          <p className="text-xs text-muted-foreground">{tr("إدارة الأقسام الرئيسية والفرعية، الصور، SEO، وقواعد العرض", "Manage main and sub categories, media, SEO, and display rules")}</p>
        </div>
        <button
          onClick={() => { setEditing({ display_order: list.length, is_active: true, display_rules: defaultRules }); setTab("basic"); }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> {tr("قسم جديد", "New category")}
        </button>
      </div>

      {editing && (
        <CategoryForm
          editing={editing}
          setEditing={setEditing}
          allCats={list}
          tab={tab}
          setTab={setTab}
          onSave={save}
          onCancel={() => setEditing(null)}
          tr={tr}
          lang={lang}
        />
      )}

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{tr("جاري التحميل...", "Loading...")}</p>
        ) : tree.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">{tr("لا توجد أقسام", "No categories")}</p>
        ) : (
          <div className="divide-y divide-border">
            {tree.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                depth={0}
                expanded={expanded}
                toggleExpand={toggleExpand}
                onEdit={(c) => { setEditing(c); setTab("basic"); }}
                onDelete={remove}
                onToggleActive={toggleActive}
                onMove={move}
                onLink={(id) => setLinkingId(id)}
                canDelete={canDelete}
                tr={tr}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>

      {linkingId && (
        <ProductLinkerModal
          categoryId={linkingId}
          category={list.find((c) => c.id === linkingId)!}
          onClose={() => setLinkingId(null)}
          tr={tr}
          lang={lang}
        />
      )}
    </AdminShell>
  );
}

// ============= Helpers =============

function normalizeCat(raw: any): Cat {
  return {
    ...raw,
    display_rules: raw.display_rules ?? defaultRules,
  } as Cat;
}

type TreeNode = Cat & { children: TreeNode[] };
function buildTree(flat: Cat[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: TreeNode[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (n: TreeNode[]) => {
    n.sort((a, b) => a.display_order - b.display_order);
    n.forEach((x) => sortRec(x.children));
  };
  sortRec(roots);
  return roots;
}

// ============= Row =============

function CategoryRow({
  cat, depth, expanded, toggleExpand, onEdit, onDelete, onToggleActive, onMove, onLink, canDelete, tr, lang,
}: {
  cat: TreeNode; depth: number; expanded: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (c: Cat) => void; onDelete: (c: Cat) => void;
  onToggleActive: (c: Cat) => void; onMove: (c: Cat, dir: -1 | 1) => void;
  onLink: (id: string) => void; canDelete: boolean;
  tr: TrFn; lang: string;
}) {
  const hasChildren = cat.children.length > 0;
  const isOpen = expanded.has(cat.id);
  const displayName = lang === "ar" ? (cat.name_ar || cat.name_en) : (cat.name_en || cat.name_ar);
  const altName = lang === "ar" ? cat.name_en : cat.name_ar;

  return (
    <>
      <div
        className="flex items-center gap-2 p-2.5 hover:bg-muted/30"
        style={{ paddingRight: `${0.625 + depth * 1.5}rem` }}
      >
        <button
          onClick={() => hasChildren && toggleExpand(cat.id)}
          className={`rounded p-1 ${hasChildren ? "hover:bg-muted" : "opacity-0"}`}
          aria-label={tr("توسيع", "Expand")}
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {cat.image_url ? (
          <img src={cat.image_url} alt={cat.image_alt ?? ""} className="h-9 w-9 rounded object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted text-muted-foreground">
            {cat.icon ? <span className="text-base">{cat.icon}</span> : <ImageIcon className="h-4 w-4" />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {altName && altName !== displayName && <span className="text-[11px] text-muted-foreground">{altName}</span>}
            {!cat.is_active && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">{tr("معطّل", "Disabled")}</span>
            )}
            {hasChildren && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                {cat.children.length} {tr("فرعي", "sub")}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">/{cat.slug}</div>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={() => onMove(cat, -1)} className="rounded p-1.5 hover:bg-muted" title={tr("أعلى", "Move up")}>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onMove(cat, 1)} className="rounded p-1.5 hover:bg-muted" title={tr("أسفل", "Move down")}>
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onToggleActive(cat)} className="rounded p-1.5 hover:bg-muted" title={cat.is_active ? tr("إخفاء", "Hide") : tr("إظهار", "Show")}>
            {cat.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => onLink(cat.id)} className="rounded p-1.5 hover:bg-muted" title={tr("ربط منتجات", "Link products")}>
            <Package className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onEdit(cat)} className="rounded p-1.5 hover:bg-muted" title={tr("تعديل", "Edit")}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {canDelete && (
            <button onClick={() => onDelete(cat)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title={tr("حذف", "Delete")}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isOpen && cat.children.map((child) => (
        <CategoryRow
          key={child.id} cat={child} depth={depth + 1}
          expanded={expanded} toggleExpand={toggleExpand}
          onEdit={onEdit} onDelete={onDelete} onToggleActive={onToggleActive}
          onMove={onMove} onLink={onLink} canDelete={canDelete}
          tr={tr} lang={lang}
        />
      ))}
    </>
  );
}

// ============= Form =============

function CategoryForm({
  editing, setEditing, allCats, tab, setTab, onSave, onCancel, tr, lang,
}: {
  editing: Partial<Cat>;
  setEditing: (c: Partial<Cat>) => void;
  allCats: Cat[];
  tab: "basic" | "media" | "seo" | "rules";
  setTab: (t: "basic" | "media" | "seo" | "rules") => void;
  onSave: () => void; onCancel: () => void;
  tr: TrFn; lang: string;
}) {
  const rules: DisplayRules = editing.display_rules ?? defaultRules;
  const parentOptions = allCats.filter((c) => c.id !== editing.id && !c.parent_id);

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{editing.id ? tr("تعديل قسم", "Edit category") : tr("قسم جديد", "New category")}</h2>
        <div className="flex gap-1 rounded-md bg-background p-1 text-xs">
          {(["basic", "media", "seo", "rules"] as const).map((t) => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`rounded px-2.5 py-1 ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {t === "basic" ? tr("أساسي", "Basic") : t === "media" ? tr("الوسائط", "Media") : t === "seo" ? "SEO" : tr("قواعد العرض", "Display rules")}
            </button>
          ))}
        </div>
      </div>

      {tab === "basic" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={tr("القسم الأب (لإنشاء قسم فرعي)", "Parent category (for sub-categories)")}>
            <select
              value={editing.parent_id ?? ""}
              onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{tr("— قسم رئيسي —", "— Top-level —")}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>{lang === "ar" ? c.name_ar : (c.name_en || c.name_ar)}</option>
              ))}
            </select>
          </Field>
          <Input label={tr("الترتيب", "Order")} type="number" value={String(editing.display_order ?? 0)}
            onChange={(v) => setEditing({ ...editing, display_order: Number(v) })} />
          <Input label={tr("الاسم بالعربية *", "Arabic name *")} value={editing.name_ar ?? ""}
            onChange={(v) => setEditing({ ...editing, name_ar: v })} />
          <Input label={tr("الاسم بالإنجليزية", "English name")} value={editing.name_en ?? ""}
            onChange={(v) => setEditing({ ...editing, name_en: v })} />
          <Input label={tr("الرابط (slug) *", "URL slug *")} value={editing.slug ?? ""}
            onChange={(v) => setEditing({ ...editing, slug: v.toLowerCase().replace(/\s+/g, "-") })} />
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={editing.is_active ?? true}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            {tr("القسم نشط (ظاهر في المتجر)", "Active (visible in store)")}
          </label>
          <Field label={tr("الوصف بالعربية", "Arabic description")}>
            <textarea rows={3} value={editing.description_ar ?? ""}
              onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label={tr("الوصف بالإنجليزية", "English description")}>
            <textarea rows={3} value={editing.description_en ?? ""}
              onChange={(e) => setEditing({ ...editing, description_en: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </Field>
        </div>
      )}

      {tab === "media" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label={tr("رابط صورة القسم", "Category image URL")} value={editing.image_url ?? ""}
            onChange={(v) => setEditing({ ...editing, image_url: v })} />
          <Input label={tr("نص بديل للصورة (Alt)", "Image alt text")} value={editing.image_alt ?? ""}
            onChange={(v) => setEditing({ ...editing, image_alt: v })} />
          <Input label={tr("أيقونة (إيموجي أو رمز)", "Icon (emoji or symbol)")} value={editing.icon ?? ""}
            onChange={(v) => setEditing({ ...editing, icon: v })} />
          <div />
          <Input label={tr("رابط بانر القسم", "Category banner URL")} value={editing.banner_url ?? ""}
            onChange={(v) => setEditing({ ...editing, banner_url: v })} />
          <Input label={tr("رابط النقر على البانر", "Banner click URL")} value={editing.banner_link ?? ""}
            onChange={(v) => setEditing({ ...editing, banner_link: v })} />
          {editing.image_url && (
            <div className="md:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">{tr("معاينة الصورة:", "Image preview:")}</p>
              <img src={editing.image_url} alt="" className="h-24 w-24 rounded-lg object-cover" />
            </div>
          )}
          {editing.banner_url && (
            <div className="md:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">{tr("معاينة البانر:", "Banner preview:")}</p>
              <img src={editing.banner_url} alt="" className="h-32 w-full rounded-lg object-cover" />
            </div>
          )}
        </div>
      )}

      {tab === "seo" && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Meta Title" value={editing.meta_title ?? ""}
            onChange={(v) => setEditing({ ...editing, meta_title: v })} />
          <Input label={tr("OG Image (للمشاركة)", "OG Image (for sharing)")} value={editing.og_image ?? ""}
            onChange={(v) => setEditing({ ...editing, og_image: v })} />
          <Field label="Meta Description">
            <textarea rows={3} value={editing.meta_description ?? ""}
              onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2" />
          </Field>
          <div className="md:col-span-2 rounded-lg border border-border bg-background p-3">
            <p className="mb-1 text-xs text-muted-foreground">{tr("معاينة Google:", "Google preview:")}</p>
            <div className="text-xs">
              <div className="text-blue-700">{editing.meta_title || (lang === "ar" ? editing.name_ar : editing.name_en) || tr("عنوان القسم", "Category title")}</div>
              <div className="text-green-700">/{editing.slug || "slug"}</div>
              <div className="text-muted-foreground">{editing.meta_description || (lang === "ar" ? editing.description_ar : editing.description_en) || tr("وصف القسم...", "Category description...")}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <Field label={tr("ترتيب المنتجات الافتراضي", "Default product sort")}>
            <select
              value={rules.sort}
              onChange={(e) => setEditing({ ...editing, display_rules: { ...rules, sort: e.target.value as any } })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="manual">{tr("يدوي (حسب ترتيب الربط)", "Manual (by linking order)")}</option>
              <option value="newest">{tr("الأحدث أولاً", "Newest first")}</option>
              <option value="best_selling">{tr("الأكثر مبيعاً", "Best selling")}</option>
              <option value="price_asc">{tr("السعر: من الأقل", "Price: low to high")}</option>
              <option value="price_desc">{tr("السعر: من الأعلى", "Price: high to low")}</option>
            </select>
          </Field>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">{tr("الفلاتر المتاحة في صفحة القسم:", "Filters available on category page:")}</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {([
                ["price", tr("السعر", "Price")], ["color", tr("اللون", "Color")], ["size", tr("المقاس", "Size")],
                ["brand", tr("العلامة", "Brand")], ["availability", tr("التوفر", "Availability")], ["rating", tr("التقييم", "Rating")],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <input type="checkbox" checked={rules.filters[key as keyof typeof rules.filters]}
                    onChange={(e) => setEditing({
                      ...editing,
                      display_rules: { ...rules, filters: { ...rules.filters, [key]: e.target.checked } },
                    })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <button onClick={onSave} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Save className="h-3.5 w-3.5" /> {tr("حفظ", "Save")}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs">
          <X className="h-3.5 w-3.5" /> {tr("إلغاء", "Cancel")}
        </button>
      </div>
    </div>
  );
}

// ============= Product linker modal =============

function ProductLinkerModal({
  categoryId, category, onClose, tr, lang,
}: { categoryId: string; category: Cat; onClose: () => void; tr: TrFn; lang: string }) {
  const [linked, setLinked] = useState<LinkedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLinked() {
    setLoading(true);
    const { data } = await supabase
      .from("category_products")
      .select("display_order, is_pinned, product_id, products(id, name_ar, sku, image_url, price)")
      .eq("category_id", categoryId)
      .order("is_pinned", { ascending: false })
      .order("display_order", { ascending: true });
    const items: LinkedProduct[] = (data ?? []).map((r: any) => ({
      ...r.products, display_order: r.display_order, is_pinned: r.is_pinned,
    })).filter((p: any) => p.id);
    setLinked(items);
    setLoading(false);
  }

  useEffect(() => { void loadLinked(); }, [categoryId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      const { data } = await supabase
        .from("products")
        .select("id, name_ar, sku, image_url, price")
        .or(`name_ar.ilike.%${search}%,sku.ilike.%${search}%`)
        .limit(20);
      const linkedIds = new Set(linked.map((l) => l.id));
      setResults(((data ?? []) as Product[]).filter((p) => !linkedIds.has(p.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [search, linked]);

  async function link(p: Product) {
    await supabase.from("category_products").insert({
      category_id: categoryId, product_id: p.id, display_order: linked.length,
    });
    setSearch("");
    await loadLinked();
  }

  async function unlink(productId: string) {
    await supabase.from("category_products").delete()
      .eq("category_id", categoryId).eq("product_id", productId);
    await loadLinked();
  }

  async function togglePin(p: LinkedProduct) {
    await supabase.from("category_products").update({ is_pinned: !p.is_pinned })
      .eq("category_id", categoryId).eq("product_id", p.id);
    await loadLinked();
  }

  async function reorder(p: LinkedProduct, dir: -1 | 1) {
    const i = linked.findIndex((x) => x.id === p.id);
    const j = i + dir;
    if (j < 0 || j >= linked.length) return;
    const a = linked[i], b = linked[j];
    await supabase.from("category_products").update({ display_order: b.display_order })
      .eq("category_id", categoryId).eq("product_id", a.id);
    await supabase.from("category_products").update({ display_order: a.display_order })
      .eq("category_id", categoryId).eq("product_id", b.id);
    await loadLinked();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">منتجات قسم: {category.name_ar}</h2>
            <p className="text-[11px] text-muted-foreground">
              ترتيب {category.display_rules?.sort === "manual" ? "يدوي — السحب يحدد العرض" : `تلقائي (${category.display_rules?.sort})`}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج بالاسم أو SKU..."
              className="w-full rounded-md border border-border bg-background py-2 pr-10 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {results.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
              {results.map((p) => (
                <button key={p.id} onClick={() => link(p)}
                  className="flex w-full items-center gap-2 border-b border-border/50 p-2 text-right text-sm last:border-0 hover:bg-muted/50">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" /> :
                    <div className="h-8 w-8 rounded bg-muted" />}
                  <div className="flex-1">
                    <div className="text-xs font-medium">{p.name_ar}</div>
                    <div className="text-[11px] text-muted-foreground">{p.sku ?? "—"} · {p.price} ر.س</div>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-4">
          {loading ? <p className="text-center text-xs text-muted-foreground">جاري التحميل...</p> :
            linked.length === 0 ? <p className="text-center text-xs text-muted-foreground">لا توجد منتجات مرتبطة بعد</p> : (
              <div className="space-y-1.5">
                {linked.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.image_url ? <img src={p.image_url} alt="" className="h-9 w-9 rounded object-cover" /> :
                      <div className="h-9 w-9 rounded bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{p.name_ar}</div>
                      <div className="text-[10px] text-muted-foreground">{p.sku ?? "—"} · {p.price} ر.س</div>
                    </div>
                    <button onClick={() => reorder(p, -1)} className="rounded p-1 hover:bg-muted"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => reorder(p, 1)} className="rounded p-1 hover:bg-muted"><ArrowDown className="h-3 w-3" /></button>
                    <button onClick={() => togglePin(p)} className="rounded p-1 hover:bg-muted" title={p.is_pinned ? "إلغاء التثبيت" : "تثبيت"}>
                      {p.is_pinned ? <Pin className="h-3 w-3 text-primary" /> : <PinOff className="h-3 w-3 text-muted-foreground" />}
                    </button>
                    <button onClick={() => unlink(p.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

// ============= Form fields =============

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
