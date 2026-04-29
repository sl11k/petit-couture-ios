import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useAuth } from "@/state/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ArrowRight, Save, Trash2, Plus, X, Upload, Image as ImageIcon,
  Eye, Lock, AlertTriangle, Tag, Package, FileText, DollarSign,
  Box, Search, Megaphone, Calendar, Layers,
} from "lucide-react";

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductEditorPage,
});

type Variant = {
  id?: string;
  sku?: string;
  barcode?: string;
  color?: string;
  size?: string;
  volume?: string;
  flavor?: string;
  material?: string;
  price?: number | null;
  cost?: number | null;
  stock: number;
  weight?: number | null;
  image_url?: string | null;
  is_active: boolean;
  _new?: boolean;
  _deleted?: boolean;
};

type Relation = {
  id?: string;
  related_product_id: string;
  relation_type: "related" | "alternative" | "complementary" | "upsell" | "cross_sell";
  _new?: boolean;
  _deleted?: boolean;
};

type Offer = {
  id?: string;
  offer_type: "bundle" | "buy_x_get_y" | "qty_discount";
  config: any;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  _new?: boolean;
  _deleted?: boolean;
};

const TABS = [
  { id: "basic", label: "أساسي", icon: Package },
  { id: "desc", label: "الوصف", icon: FileText },
  { id: "pricing", label: "الأسعار", icon: DollarSign },
  { id: "inventory", label: "المخزون", icon: Box },
  { id: "media", label: "الصور والملفات", icon: ImageIcon },
  { id: "variants", label: "المتغيرات", icon: Layers },
  { id: "seo", label: "SEO", icon: Search },
  { id: "marketing", label: "التسويق", icon: Megaphone },
  { id: "publish", label: "النشر", icon: Calendar },
] as const;

const empty = {
  slug: "",
  sku: "",
  barcode: "",
  name_ar: "",
  name_en: "",
  brand: "",
  category_id: "",
  short_description_ar: "",
  short_description_en: "",
  description_ar: "",
  description_en: "",
  price: 0,
  compare_at_price: null as number | null,
  cost: null as number | null,
  tax_rate: 0.15,
  sale_starts_at: null as string | null,
  sale_ends_at: null as string | null,
  weight: null as number | null,
  dimensions: { length: 0, width: 0, height: 0 } as any,
  currency: "SAR",
  image_url: "",
  images: [] as string[],
  video_url: "",
  attachments: [] as string[],
  image_alt: "",
  stock: 0,
  low_stock_threshold: 5,
  allow_preorder: false,
  hide_when_out_of_stock: false,
  deduct_on: "order",
  status: "draft",
  product_type: "physical",
  publish_at: null as string | null,
  meta_title: "",
  meta_description: "",
  og_image: "",
  sizes: [] as string[],
  colors: [] as string[],
  is_active: true,
};

function ProductEditorPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canEditOrders, canManage, loading: roleLoading } = useUserRole();

  const [tab, setTab] = useState<typeof TABS[number]["id"]>("basic");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [form, setForm] = useState<any>({ ...empty });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  // ============= Load =============
  useEffect(() => {
    supabase.from("categories").select("id, name_ar, name_en").then(({ data }) => setCategories(data ?? []));
    supabase.from("products").select("id, slug, name_ar, image_url").limit(500).then(({ data }) => setAllProducts(data ?? []));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    (async () => {
      const { data: p } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (p) {
        setForm({
          ...empty,
          ...p,
          dimensions: (p as any).dimensions || { length: 0, width: 0, height: 0 },
          images: Array.isArray((p as any).images) ? (p as any).images : [],
          attachments: Array.isArray((p as any).attachments) ? (p as any).attachments : [],
          sizes: Array.isArray((p as any).sizes) ? (p as any).sizes : [],
          colors: Array.isArray((p as any).colors) ? (p as any).colors : [],
        });
      }
      const { data: vs } = await supabase.from("product_variants").select("*").eq("product_id", id);
      setVariants((vs as Variant[]) ?? []);
      const { data: rs } = await supabase.from("product_relations").select("*").eq("product_id", id);
      setRelations((rs as Relation[]) ?? []);
      const { data: os } = await supabase.from("product_offers").select("*").eq("product_id", id);
      setOffers((os as Offer[]) ?? []);
      setLoading(false);
    })();
  }, [id, isNew]);

  function set<K extends keyof typeof empty>(k: K, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  // ============= Image upload =============
  async function uploadImage(file: File, folder = "products"): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) { setError(upErr.message); return null; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onPickMainImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await uploadImage(f);
    if (url) set("image_url", url);
  }

  async function onPickGalleryImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const urls: string[] = [];
    for (const f of files) {
      const u = await uploadImage(f);
      if (u) urls.push(u);
    }
    set("images", [...form.images, ...urls]);
  }

  // ============= Save =============
  async function save(closeAfter = false) {
    if (!canEditOrders) { setError("لا تملك صلاحية"); return; }
    if (!form.name_ar.trim() || !form.slug.trim()) { setError("الاسم العربي والـ slug مطلوبين"); setTab("basic"); return; }
    setSaving(true); setError(null);

    const payload: any = {
      slug: form.slug, sku: form.sku || null, barcode: form.barcode || null,
      name_ar: form.name_ar, name_en: form.name_en || null,
      brand: form.brand || null,
      category_id: form.category_id || null,
      short_description_ar: form.short_description_ar || null,
      short_description_en: form.short_description_en || null,
      description_ar: form.description_ar || null,
      description_en: form.description_en || null,
      price: Number(form.price) || 0,
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      cost: form.cost ? Number(form.cost) : null,
      tax_rate: Number(form.tax_rate) || 0,
      sale_starts_at: form.sale_starts_at || null,
      sale_ends_at: form.sale_ends_at || null,
      weight: form.weight ? Number(form.weight) : null,
      dimensions: form.dimensions,
      currency: form.currency || "SAR",
      image_url: form.image_url || null,
      images: form.images,
      video_url: form.video_url || null,
      attachments: form.attachments,
      image_alt: form.image_alt || null,
      stock: Number(form.stock) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      allow_preorder: !!form.allow_preorder,
      hide_when_out_of_stock: !!form.hide_when_out_of_stock,
      deduct_on: form.deduct_on,
      status: form.status,
      product_type: form.product_type,
      publish_at: form.publish_at || null,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      og_image: form.og_image || null,
      sizes: form.sizes,
      colors: form.colors,
      is_active: form.status === "active",
    };

    let prodId = id;
    if (isNew) {
      const { data, error: e } = await (supabase.from("products") as any).insert(payload).select("id").single();
      if (e || !data) { setError(e?.message || "فشل الإنشاء"); setSaving(false); return; }
      prodId = (data as any).id;
    } else {
      const { error: e } = await (supabase.from("products") as any).update(payload).eq("id", id);
      if (e) { setError(e.message); setSaving(false); return; }
    }

    // Variants sync
    for (const v of variants) {
      if (v._deleted && v.id) {
        await supabase.from("product_variants").delete().eq("id", v.id);
      } else if (v._new) {
        const { _new, _deleted, id: _id, ...rest } = v as any;
        await (supabase.from("product_variants") as any).insert({ ...rest, product_id: prodId });
      } else if (v.id) {
        const { _new, _deleted, id: _id, ...rest } = v as any;
        await (supabase.from("product_variants") as any).update(rest).eq("id", v.id);
      }
    }

    // Relations sync
    for (const r of relations) {
      if (r._deleted && r.id) {
        await supabase.from("product_relations").delete().eq("id", r.id);
      } else if (r._new) {
        await (supabase.from("product_relations") as any).insert({
          product_id: prodId, related_product_id: r.related_product_id, relation_type: r.relation_type,
        });
      }
    }

    // Offers sync
    for (const o of offers) {
      if (o._deleted && o.id) {
        await supabase.from("product_offers").delete().eq("id", o.id);
      } else if (o._new) {
        const { _new, _deleted, id: _id, ...rest } = o as any;
        await (supabase.from("product_offers") as any).insert({ ...rest, product_id: prodId });
      } else if (o.id) {
        const { _new, _deleted, id: _id, ...rest } = o as any;
        await (supabase.from("product_offers") as any).update(rest).eq("id", o.id);
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: isNew ? "product.created" : "product.updated",
      entity: "product",
      entity_id: prodId,
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      metadata: { name: form.name_ar, status: form.status, price: form.price },
    });

    setSaving(false);
    if (isNew && prodId) {
      navigate({ to: "/admin/products/$id", params: { id: prodId } });
    } else if (closeAfter) {
      navigate({ to: "/admin/products" });
    } else {
      // refresh local
      const { data: vs } = await supabase.from("product_variants").select("*").eq("product_id", prodId!);
      setVariants((vs as Variant[]) ?? []);
    }
  }

  async function deleteProduct() {
    if (!canManage || isNew) return;
    if (!confirm("حذف المنتج نهائياً؟")) return;
    await supabase.from("products").delete().eq("id", id);
    await supabase.from("audit_logs").insert({
      action: "product.deleted", entity: "product", entity_id: id,
      actor_id: user?.id ?? null, actor_email: user?.email ?? null,
      metadata: { name: form.name_ar },
    });
    navigate({ to: "/admin/products" });
  }

  if (roleLoading || loading) {
    return <AdminShell><div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div></AdminShell>;
  }
  if (!canEditOrders) {
    return (
      <AdminShell>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">صلاحية غير كافية</h2>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/products" className="rounded p-1.5 hover:bg-accent"><ArrowRight className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-semibold">{isNew ? "منتج جديد" : form.name_ar || "تعديل منتج"}</h1>
            {!isNew && <p className="text-xs text-muted-foreground">{form.sku || form.slug}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && form.slug && (
            <a href={`/product/${form.slug}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
              <Eye className="h-4 w-4" /> معاينة
            </a>
          )}
          {!isNew && canManage && (
            <button onClick={deleteProduct} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/20">
              <Trash2 className="h-4 w-4" /> حذف
            </button>
          )}
          <button onClick={() => save(false)} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "..." : "حفظ"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /><span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-4">
        {tab === "basic" && (
          <Card title="معلومات أساسية">
            <Grid2>
              <Field label="الاسم بالعربية *" value={form.name_ar} onChange={(v) => set("name_ar", v)} />
              <Field label="الاسم بالإنجليزية" value={form.name_en} onChange={(v) => set("name_en", v)} />
              <Field label="Slug *" value={form.slug} onChange={(v) => set("slug", v.toLowerCase().replace(/\s+/g, "-"))} />
              <Field label="SKU" value={form.sku} onChange={(v) => set("sku", v)} />
              <Field label="Barcode" value={form.barcode} onChange={(v) => set("barcode", v)} />
              <Field label="العلامة التجارية" value={form.brand} onChange={(v) => set("brand", v)} />
              <Select label="القسم" value={form.category_id} onChange={(v) => set("category_id", v)}>
                <option value="">— بدون —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar || c.name_en}</option>)}
              </Select>
              <Select label="نوع المنتج" value={form.product_type} onChange={(v) => set("product_type", v)}>
                <option value="physical">مادي</option>
                <option value="digital">رقمي</option>
                <option value="service">خدمة</option>
                <option value="subscription">اشتراك</option>
              </Select>
            </Grid2>
          </Card>
        )}

        {tab === "desc" && (
          <Card title="الأوصاف">
            <div className="grid gap-3">
              <Textarea label="وصف قصير (عربي)" rows={2} value={form.short_description_ar} onChange={(v) => set("short_description_ar", v)} />
              <Textarea label="وصف قصير (إنجليزي)" rows={2} value={form.short_description_en} onChange={(v) => set("short_description_en", v)} />
              <Textarea label="وصف طويل (عربي)" rows={6} value={form.description_ar} onChange={(v) => set("description_ar", v)} />
              <Textarea label="وصف طويل (إنجليزي)" rows={6} value={form.description_en} onChange={(v) => set("description_en", v)} />
            </div>
          </Card>
        )}

        {tab === "pricing" && (
          <Card title="الأسعار">
            <Grid2>
              <Field type="number" label="السعر *" value={form.price} onChange={(v) => set("price", Number(v))} />
              <Field type="number" label="سعر التخفيض (الأصلي)" value={form.compare_at_price ?? ""} onChange={(v) => set("compare_at_price", v === "" ? null : Number(v))} />
              <Field type="number" label="التكلفة (Cost)" value={form.cost ?? ""} onChange={(v) => set("cost", v === "" ? null : Number(v))} />
              <Field type="number" step="0.01" label="نسبة الضريبة (مثال: 0.15)" value={form.tax_rate} onChange={(v) => set("tax_rate", Number(v))} />
              <Field type="datetime-local" label="بداية التخفيض" value={form.sale_starts_at?.slice(0, 16) ?? ""} onChange={(v) => set("sale_starts_at", v ? new Date(v).toISOString() : null)} />
              <Field type="datetime-local" label="نهاية التخفيض" value={form.sale_ends_at?.slice(0, 16) ?? ""} onChange={(v) => set("sale_ends_at", v ? new Date(v).toISOString() : null)} />
            </Grid2>
            {form.cost && form.price && (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                هامش الربح: <strong>{((Number(form.price) - Number(form.cost)) / Number(form.price) * 100).toFixed(1)}%</strong>
                {" — "}
                ربح/قطعة: <strong>{(Number(form.price) - Number(form.cost)).toFixed(2)} ر.س</strong>
              </div>
            )}
          </Card>
        )}

        {tab === "inventory" && (
          <Card title="المخزون">
            <Grid2>
              <Field type="number" label="الكمية الحالية" value={form.stock} onChange={(v) => set("stock", Number(v))} />
              <Field type="number" label="حد التنبيه (Low Stock)" value={form.low_stock_threshold} onChange={(v) => set("low_stock_threshold", Number(v))} />
              <Field type="number" step="0.01" label="الوزن (كجم)" value={form.weight ?? ""} onChange={(v) => set("weight", v === "" ? null : Number(v))} />
              <div>
                <label className="text-xs text-muted-foreground">الأبعاد (سم)</label>
                <div className="mt-1 flex gap-2">
                  {["length", "width", "height"].map((d) => (
                    <input key={d} type="number" placeholder={d === "length" ? "طول" : d === "width" ? "عرض" : "ارتفاع"}
                      value={form.dimensions?.[d] ?? ""}
                      onChange={(e) => set("dimensions", { ...form.dimensions, [d]: Number(e.target.value) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  ))}
                </div>
              </div>
              <Select label="خصم المخزون" value={form.deduct_on} onChange={(v) => set("deduct_on", v)}>
                <option value="order">عند إنشاء الطلب</option>
                <option value="payment">عند الدفع</option>
                <option value="ship">عند الشحن</option>
              </Select>
            </Grid2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle label="السماح بالطلب المسبق (Pre-order)" checked={form.allow_preorder} onChange={(v) => set("allow_preorder", v)} />
              <Toggle label="إخفاء تلقائي عند نفاد الكمية" checked={form.hide_when_out_of_stock} onChange={(v) => set("hide_when_out_of_stock", v)} />
            </div>
          </Card>
        )}

        {tab === "media" && (
          <>
            <Card title="الصورة الرئيسية">
              <div className="flex items-start gap-4">
                {form.image_url ? (
                  <img src={form.image_url} className="h-32 w-32 rounded-md object-cover" alt="" />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-md bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" /> رفع صورة
                    <input type="file" accept="image/*" onChange={onPickMainImage} className="hidden" />
                  </label>
                  <Field label="نص بديل (Alt Text)" value={form.image_alt} onChange={(v) => set("image_alt", v)} />
                </div>
              </div>
            </Card>
            <Card title="معرض الصور">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {form.images.map((url: string, i: number) => (
                  <div key={i} className="group relative">
                    <img src={url} className="aspect-square w-full rounded-md object-cover" alt="" />
                    <button onClick={() => set("images", form.images.filter((_: any, j: number) => j !== i))}
                      className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border hover:bg-accent">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple onChange={onPickGalleryImages} className="hidden" />
                </label>
              </div>
            </Card>
            <Card title="فيديو ومرفقات">
              <Field label="رابط فيديو (YouTube/Vimeo)" value={form.video_url} onChange={(v) => set("video_url", v)} />
              <p className="mt-2 text-xs text-muted-foreground">الملفات المرفقة (PDF، أدلة): يمكن إضافتها لاحقاً عبر الكود.</p>
            </Card>
          </>
        )}

        {tab === "variants" && (
          <Card title="المتغيرات">
            <p className="mb-3 text-xs text-muted-foreground">كل متغير له SKU وسعر ومخزون مستقل. اترك السعر فارغاً لاستخدام السعر الأساسي.</p>
            <div className="space-y-3">
              {variants.filter((v) => !v._deleted).map((v, i) => {
                const realIdx = variants.indexOf(v);
                return (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <Field label="SKU" value={v.sku ?? ""} onChange={(x) => updateVariant(realIdx, { sku: x })} />
                      <Field label="لون" value={v.color ?? ""} onChange={(x) => updateVariant(realIdx, { color: x })} />
                      <Field label="مقاس" value={v.size ?? ""} onChange={(x) => updateVariant(realIdx, { size: x })} />
                      <Field label="حجم" value={v.volume ?? ""} onChange={(x) => updateVariant(realIdx, { volume: x })} />
                      <Field label="نكهة" value={v.flavor ?? ""} onChange={(x) => updateVariant(realIdx, { flavor: x })} />
                      <Field label="مادة" value={v.material ?? ""} onChange={(x) => updateVariant(realIdx, { material: x })} />
                      <Field type="number" label="السعر" value={v.price ?? ""} onChange={(x) => updateVariant(realIdx, { price: x === "" ? null : Number(x) })} />
                      <Field type="number" label="المخزون" value={v.stock} onChange={(x) => updateVariant(realIdx, { stock: Number(x) })} />
                      <Field type="number" step="0.01" label="الوزن" value={v.weight ?? ""} onChange={(x) => updateVariant(realIdx, { weight: x === "" ? null : Number(x) })} />
                      <Field label="رابط الصورة" value={v.image_url ?? ""} onChange={(x) => updateVariant(realIdx, { image_url: x })} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Toggle label="نشط" checked={v.is_active} onChange={(x) => updateVariant(realIdx, { is_active: x })} />
                      <button onClick={() => updateVariant(realIdx, { _deleted: true })} className="text-xs text-destructive hover:underline">
                        حذف المتغير
                      </button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setVariants((vs) => [...vs, { stock: 0, is_active: true, _new: true } as Variant])}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-accent">
                <Plus className="h-4 w-4" /> إضافة متغير
              </button>
            </div>
          </Card>
        )}

        {tab === "seo" && (
          <Card title="SEO">
            <Grid2>
              <Field label="Meta Title" value={form.meta_title} onChange={(v) => set("meta_title", v)} />
              <Field label="URL Slug" value={form.slug} onChange={(v) => set("slug", v)} />
            </Grid2>
            <Textarea label="Meta Description" rows={3} value={form.meta_description} onChange={(v) => set("meta_description", v)} />
            <Field label="صورة المشاركة (Open Graph)" value={form.og_image} onChange={(v) => set("og_image", v)} />
            <div className="mt-4 rounded-md bg-muted p-3 text-xs">
              <div className="font-semibold">معاينة في Google:</div>
              <div className="mt-2 text-blue-700 dark:text-blue-400">{form.meta_title || form.name_ar}</div>
              <div className="text-emerald-700 dark:text-emerald-400">/product/{form.slug}</div>
              <div className="text-zinc-700 dark:text-zinc-300">{form.meta_description || form.short_description_ar}</div>
            </div>
            <div className="mt-3 rounded-md bg-muted p-3 text-xs">
              <div className="font-semibold mb-1">Structured Data (يُولّد تلقائياً في صفحة المنتج)</div>
              <code className="text-[10px]">{`{ "@type": "Product", "name": "${form.name_ar}", "image": "${form.image_url}", "offers": { "price": ${form.price}, "priceCurrency": "${form.currency}" } }`}</code>
            </div>
          </Card>
        )}

        {tab === "marketing" && (
          <>
            <Card title="منتجات مرتبطة">
              <RelationsEditor
                relations={relations}
                setRelations={setRelations}
                allProducts={allProducts.filter((p) => p.id !== id)}
              />
            </Card>
            <Card title="العروض (Bundle / Buy X Get Y / عروض الكمية)">
              <OffersEditor offers={offers} setOffers={setOffers} />
            </Card>
          </>
        )}

        {tab === "publish" && (
          <Card title="النشر والحالة">
            <Grid2>
              <Select label="الحالة" value={form.status} onChange={(v) => set("status", v)}>
                <option value="draft">مسودة</option>
                <option value="active">نشط</option>
                <option value="hidden">مخفي</option>
                <option value="coming_soon">قادم قريباً</option>
                <option value="archived">أرشيف</option>
              </Select>
              <Field type="datetime-local" label="جدولة النشر" value={form.publish_at?.slice(0, 16) ?? ""}
                onChange={(v) => set("publish_at", v ? new Date(v).toISOString() : null)} />
            </Grid2>
            <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {form.status === "draft" && "المنتج محفوظ كمسودة ولا يظهر في المتجر."}
              {form.status === "active" && "المنتج منشور وظاهر للعملاء."}
              {form.status === "hidden" && "المنتج موجود لكن غير ظاهر في القوائم."}
              {form.status === "coming_soon" && "المنتج يظهر بشارة 'قادم قريباً' دون شراء."}
              {form.status === "archived" && "المنتج مؤرشف ومحفوظ للسجل فقط."}
              {form.publish_at && new Date(form.publish_at) > new Date() && (
                <div className="mt-1">⏰ سيُنشر في: {new Date(form.publish_at).toLocaleString("ar-SA")}</div>
              )}
            </div>
          </Card>
        )}
      </div>
    </AdminShell>
  );

  function updateVariant(idx: number, patch: Partial<Variant>) {
    setVariants((vs) => vs.map((v, i) => i === idx ? { ...v, ...patch } : v));
  }
}

// ============= Subcomponents =============
function RelationsEditor({ relations, setRelations, allProducts }: any) {
  const REL_LABEL: Record<string, string> = {
    related: "مرتبط", alternative: "بديل", complementary: "مكمل", upsell: "Upsell", cross_sell: "Cross-sell",
  };
  const [newRel, setNewRel] = useState({ related_product_id: "", relation_type: "related" as Relation["relation_type"] });
  return (
    <div>
      <div className="space-y-2">
        {relations.filter((r: Relation) => !r._deleted).map((r: Relation, i: number) => {
          const realIdx = relations.indexOf(r);
          const p = allProducts.find((x: any) => x.id === r.related_product_id);
          return (
            <div key={i} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <div className="flex items-center gap-2">
                {p?.image_url && <img src={p.image_url} className="h-8 w-8 rounded object-cover" alt="" />}
                <div>
                  <div>{p?.name_ar ?? r.related_product_id}</div>
                  <div className="text-xs text-muted-foreground">{REL_LABEL[r.relation_type]}</div>
                </div>
              </div>
              <button onClick={() => setRelations((rs: Relation[]) => rs.map((x, j) => j === realIdx ? { ...x, _deleted: true } : x))}
                className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={newRel.related_product_id} onChange={(e) => setNewRel({ ...newRel, related_product_id: e.target.value })}
          className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">— اختر منتج —</option>
          {allProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
        </select>
        <select value={newRel.relation_type} onChange={(e) => setNewRel({ ...newRel, relation_type: e.target.value as any })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          {Object.entries(REL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button
          onClick={() => {
            if (!newRel.related_product_id) return;
            setRelations((rs: Relation[]) => [...rs, { ...newRel, _new: true }]);
            setNewRel({ related_product_id: "", relation_type: "related" });
          }}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">إضافة</button>
      </div>
    </div>
  );
}

function OffersEditor({ offers, setOffers }: any) {
  const TYPE_LABEL: Record<string, string> = { bundle: "Bundle", buy_x_get_y: "اشترِ X احصل على Y", qty_discount: "خصم على الكمية" };
  return (
    <div>
      <div className="space-y-2">
        {offers.filter((o: Offer) => !o._deleted).map((o: Offer, i: number) => {
          const realIdx = offers.indexOf(o);
          return (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{TYPE_LABEL[o.offer_type]}</div>
                <button onClick={() => setOffers((os: Offer[]) => os.map((x, j) => j === realIdx ? { ...x, _deleted: true } : x))}
                  className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <textarea
                value={JSON.stringify(o.config, null, 2)}
                onChange={(e) => {
                  try { const cfg = JSON.parse(e.target.value); setOffers((os: Offer[]) => os.map((x, j) => j === realIdx ? { ...x, config: cfg } : x)); } catch {}
                }}
                rows={3}
                className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
              />
              <Toggle label="نشط" checked={o.is_active} onChange={(v) => setOffers((os: Offer[]) => os.map((x, j) => j === realIdx ? { ...x, is_active: v } : x))} />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        {Object.entries(TYPE_LABEL).map(([k, v]) => (
          <button key={k} onClick={() => {
            const defaults: Record<string, any> = {
              bundle: { items: [], bundle_price: 0 },
              buy_x_get_y: { buy_qty: 2, get_qty: 1, get_discount_pct: 100 },
              qty_discount: { tiers: [{ min_qty: 3, discount_pct: 10 }, { min_qty: 5, discount_pct: 15 }] },
            };
            setOffers((os: Offer[]) => [...os, { offer_type: k as any, config: defaults[k], is_active: true, _new: true }]);
          }} className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs hover:bg-accent">
            <Plus className="me-1 inline h-3 w-3" /> {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============= UI primitives =============
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}
function Grid2({ children }: any) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div>; }
function Field({ label, value, onChange, type = "text", step }: { label: string; value: any; onChange: (v: any) => void; type?: string; step?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}
function Textarea({ label, value, onChange, rows = 3 }: { label: string; value: any; onChange: (v: any) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}
function Select({ label, value, onChange, children }: { label: string; value: any; onChange: (v: any) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        {children}
      </select>
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
