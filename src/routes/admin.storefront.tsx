import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye, EyeOff, Upload, GripVertical } from "lucide-react";
import { AdminShell } from "@/components/AdminLayout";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAnnouncements,
  fetchBanners,
  fetchFeaturedCategories,
  fetchPopularPicks,
  fetchStorefrontSettings,
  clearStorefrontSettingsCache,
  uploadStorefrontImage,
  type AnnouncementMessage,
  type Banner,
  type FeaturedCategory,
  type PopularPick,
  type StorefrontSettings,
} from "@/lib/storefront";

export const Route = createFileRoute("/admin/storefront")({
  component: StorefrontAdmin,
});

type Tab = "banners" | "categories" | "popular" | "announcements" | "footer";

function StorefrontAdmin() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [tab, setTab] = useState<Tab>("banners");

  return (
    <AdminShell>
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-foreground">{ar ? "إدارة الواجهة" : "Storefront management"}</h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "تحكم في البانرات، الكاتيجوريز، الإعلانات، والفوتر." : "Control banners, categories, announcements, and footer."}
          </p>
        </header>

        <nav
          className="sticky top-14 z-20 -mx-4 flex flex-wrap gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6"
          role="tablist"
          aria-label={ar ? "أقسام إدارة الواجهة" : "Storefront sections"}
        >
          {([
            ["banners", ar ? "البانرات" : "Banners"],
            ["categories", ar ? "كاتيجوريز مميزة" : "Featured Categories"],
            ["popular", ar ? "الأكثر شهرة" : "Popular Picks"],
            ["announcements", ar ? "شريط الإعلانات" : "Announcements"],
            ["footer", ar ? "الفوتر والإعدادات" : "Footer & Settings"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${tab === k ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground hover:bg-muted/70"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div key={tab} className="animate-in fade-in duration-200">
          {tab === "banners" && <BannersPanel ar={ar} />}
          {tab === "categories" && <FeaturedCategoriesPanel ar={ar} />}
          {tab === "popular" && <PopularPicksPanel ar={ar} />}
          {tab === "announcements" && <AnnouncementsPanel ar={ar} />}
          {tab === "footer" && <FooterPanel ar={ar} />}
        </div>
      </div>
    </AdminShell>
  );
}

/* -------------------- Banners -------------------- */
function BannersPanel({ ar }: { ar: boolean }) {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => fetchBanners(false).then(setItems).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const addBlank = async () => {
    const { data, error } = await supabase.from("storefront_banners").insert({
      image_url: "https://placehold.co/1280x720/F8F5EF/4A2D2A?text=New+Banner",
      title_ar: "بانر جديد", title_en: "New banner",
      sort_order: items.length, is_active: true,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setItems([...items, data as Banner]);
    toast.success(ar ? "تمت الإضافة" : "Added");
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{ar ? `${items.length} بانر` : `${items.length} banners`}</p>
        <button onClick={addBlank} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> {ar ? "إضافة بانر" : "Add banner"}
        </button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((b) => <BannerCard key={b.id} banner={b} ar={ar} onChange={reload} />)}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center md:col-span-2">
              {ar ? "لا توجد بانرات بعد. أضف أول بانر." : "No banners yet. Add your first banner."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function BannerCard({ banner, ar, onChange }: { banner: Banner; ar: boolean; onChange: () => void }) {
  const [b, setB] = useState(banner);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("storefront_banners").update({
      image_url: b.image_url, title_ar: b.title_ar, title_en: b.title_en,
      subtitle_ar: b.subtitle_ar, subtitle_en: b.subtitle_en,
      eyebrow_ar: b.eyebrow_ar, eyebrow_en: b.eyebrow_en,
      cta_label_ar: b.cta_label_ar, cta_label_en: b.cta_label_en, cta_url: b.cta_url,
      sort_order: b.sort_order, is_active: b.is_active,
    }).eq("id", b.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(ar ? "تم الحفظ" : "Saved");
  };
  const remove = async () => {
    if (!confirm(ar ? "حذف هذا البانر؟" : "Delete this banner?")) return;
    const { error } = await supabase.from("storefront_banners").delete().eq("id", b.id);
    if (error) toast.error(error.message); else { toast.success(ar ? "تم الحذف" : "Deleted"); onChange(); }
  };
  const upload = async (file: File) => {
    try {
      const url = await uploadStorefrontImage(file, "banners");
      setB({ ...b, image_url: url });
      toast.success(ar ? "تم رفع الصورة" : "Image uploaded");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="relative">
        <img src={b.image_url} alt="" className="w-full h-40 object-cover rounded" />
        <button onClick={() => fileRef.current?.click()} className="absolute top-2 end-2 inline-flex items-center gap-1 bg-background/90 rounded-md px-2 py-1 text-[10px] border border-border">
          <Upload className="h-3 w-3" /> {ar ? "تغيير" : "Change"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Input label={ar ? "عنوان (ع)" : "Title AR"} value={b.title_ar ?? ""} onChange={(v) => setB({ ...b, title_ar: v })} />
        <Input label={ar ? "عنوان (En)" : "Title EN"} value={b.title_en ?? ""} onChange={(v) => setB({ ...b, title_en: v })} />
        <Input label={ar ? "فرعي (ع)" : "Subtitle AR"} value={b.subtitle_ar ?? ""} onChange={(v) => setB({ ...b, subtitle_ar: v })} />
        <Input label={ar ? "فرعي (En)" : "Subtitle EN"} value={b.subtitle_en ?? ""} onChange={(v) => setB({ ...b, subtitle_en: v })} />
        <Input label={ar ? "Eyebrow (ع)" : "Eyebrow AR"} value={b.eyebrow_ar ?? ""} onChange={(v) => setB({ ...b, eyebrow_ar: v })} />
        <Input label={ar ? "Eyebrow (En)" : "Eyebrow EN"} value={b.eyebrow_en ?? ""} onChange={(v) => setB({ ...b, eyebrow_en: v })} />
        <Input label={ar ? "نص الزر (ع)" : "CTA AR"} value={b.cta_label_ar ?? ""} onChange={(v) => setB({ ...b, cta_label_ar: v })} />
        <Input label={ar ? "نص الزر (En)" : "CTA EN"} value={b.cta_label_en ?? ""} onChange={(v) => setB({ ...b, cta_label_en: v })} />
        <Input label={ar ? "رابط الزر" : "CTA URL"} value={b.cta_url ?? ""} onChange={(v) => setB({ ...b, cta_url: v })} className="col-span-2" />
        <Input label={ar ? "الترتيب" : "Order"} type="number" value={String(b.sort_order)} onChange={(v) => setB({ ...b, sort_order: parseInt(v) || 0 })} />
        <label className="flex items-end gap-2 pb-1">
          <input type="checkbox" checked={b.is_active} onChange={(e) => setB({ ...b, is_active: e.target.checked })} />
          <span>{ar ? "نشط" : "Active"}</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Save className="h-3 w-3" /> {ar ? "حفظ" : "Save"}
        </button>
        <button onClick={remove} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs text-destructive">
          <Trash2 className="h-3 w-3" /> {ar ? "حذف" : "Delete"}
        </button>
      </div>
    </div>
  );
}

/* -------------------- Featured Categories -------------------- */
function FeaturedCategoriesPanel({ ar }: { ar: boolean }) {
  const [items, setItems] = useState<FeaturedCategory[]>([]);
  const reload = () => fetchFeaturedCategories(false).then(setItems);
  useEffect(() => { reload(); }, []);

  const add = async () => {
    const { data, error } = await supabase.from("featured_categories").insert({
      label_ar: "جديد", label_en: "New", link_url: "/category/new-in",
      sort_order: items.length, is_active: true,
    }).select().single();
    if (error) toast.error(error.message); else setItems([...items, data as FeaturedCategory]);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {ar ? "أزرار الكاتيجوريز المميزة (رضّع، بنات، أولاد...)" : "Featured category buttons (Babies, Girls, Boys...)"}
        </p>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> {ar ? "إضافة" : "Add"}
        </button>
      </div>
      <div className="grid gap-2">
        {items.map((it) => <FeatCatRow key={it.id} item={it} ar={ar} onChange={reload} />)}
        {items.length === 0 && <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">{ar ? "لا توجد عناصر" : "No items"}</p>}
      </div>
    </section>
  );
}

function FeatCatRow({ item, ar, onChange }: { item: FeaturedCategory; ar: boolean; onChange: () => void }) {
  const [it, setIt] = useState(item);
  const save = async () => {
    const { error } = await supabase.from("featured_categories").update({
      label_ar: it.label_ar, label_en: it.label_en, link_url: it.link_url,
      sort_order: it.sort_order, is_active: it.is_active,
    }).eq("id", it.id);
    if (error) toast.error(error.message); else toast.success(ar ? "تم الحفظ" : "Saved");
  };
  const remove = async () => {
    if (!confirm(ar ? "حذف؟" : "Delete?")) return;
    await supabase.from("featured_categories").delete().eq("id", it.id);
    onChange();
  };
  return (
    <div className="rounded border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end text-xs">
      <GripVertical className="h-4 w-4 text-muted-foreground hidden md:block" />
      <Input label={ar ? "اسم (ع)" : "Label AR"} value={it.label_ar} onChange={(v) => setIt({ ...it, label_ar: v })} />
      <Input label={ar ? "اسم (En)" : "Label EN"} value={it.label_en} onChange={(v) => setIt({ ...it, label_en: v })} />
      <Input label={ar ? "الرابط" : "Link URL"} value={it.link_url} onChange={(v) => setIt({ ...it, link_url: v })} />
      <Input label={ar ? "الترتيب" : "Order"} type="number" value={String(it.sort_order)} onChange={(v) => setIt({ ...it, sort_order: parseInt(v) || 0 })} />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1"><input type="checkbox" checked={it.is_active} onChange={(e) => setIt({ ...it, is_active: e.target.checked })} />{it.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</label>
        <button onClick={save} className="rounded bg-primary px-2 py-1 text-primary-foreground"><Save className="h-3 w-3" /></button>
        <button onClick={remove} className="rounded border border-border px-2 py-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  );
}

/* -------------------- Popular Picks -------------------- */
function PopularPicksPanel({ ar }: { ar: boolean }) {
  const [items, setItems] = useState<PopularPick[]>([]);
  const reload = () => fetchPopularPicks(false).then(setItems);
  useEffect(() => { reload(); }, []);

  const add = async () => {
    const { data, error } = await supabase.from("popular_picks").insert({
      label_ar: "جديد", label_en: "New",
      image_url: "https://placehold.co/600x450/F8F5EF/4A2D2A?text=Image",
      link_url: "/category/new-in",
      sort_order: items.length, is_active: true,
    }).select().single();
    if (error) toast.error(error.message); else setItems([...items, data as PopularPick]);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{ar ? "البطاقات المعروضة في قسم 'الأكثر شهرة'" : "Cards shown in 'Most Popular' section"}</p>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Plus className="h-3.5 w-3.5" /> {ar ? "إضافة" : "Add"}</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((it) => <PopularRow key={it.id} item={it} ar={ar} onChange={reload} />)}
        {items.length === 0 && <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center md:col-span-2">{ar ? "لا توجد عناصر" : "No items"}</p>}
      </div>
    </section>
  );
}

function PopularRow({ item, ar, onChange }: { item: PopularPick; ar: boolean; onChange: () => void }) {
  const [it, setIt] = useState(item);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = async () => {
    const { error } = await supabase.from("popular_picks").update({
      label_ar: it.label_ar, label_en: it.label_en, image_url: it.image_url, link_url: it.link_url,
      sort_order: it.sort_order, is_active: it.is_active,
    }).eq("id", it.id);
    if (error) toast.error(error.message); else toast.success(ar ? "تم" : "Saved");
  };
  const remove = async () => { if (!confirm(ar ? "حذف؟" : "Delete?")) return; await supabase.from("popular_picks").delete().eq("id", it.id); onChange(); };
  const upload = async (file: File) => { try { const url = await uploadStorefrontImage(file, "popular"); setIt({ ...it, image_url: url }); } catch (e: any) { toast.error(e.message); } };

  return (
    <div className="rounded border border-border bg-card p-3 space-y-2">
      <div className="relative">
        <img src={it.image_url} alt="" className="w-full h-28 object-cover rounded" />
        <button onClick={() => fileRef.current?.click()} className="absolute top-1 end-1 bg-background/90 rounded px-2 py-1 text-[10px] border border-border inline-flex items-center gap-1"><Upload className="h-3 w-3" />{ar ? "صورة" : "Image"}</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Input label={ar ? "اسم (ع)" : "Label AR"} value={it.label_ar} onChange={(v) => setIt({ ...it, label_ar: v })} />
        <Input label={ar ? "اسم (En)" : "Label EN"} value={it.label_en} onChange={(v) => setIt({ ...it, label_en: v })} />
        <Input label={ar ? "الرابط" : "Link URL"} value={it.link_url} onChange={(v) => setIt({ ...it, link_url: v })} className="col-span-2" />
        <Input label={ar ? "الترتيب" : "Order"} type="number" value={String(it.sort_order)} onChange={(v) => setIt({ ...it, sort_order: parseInt(v) || 0 })} />
        <label className="flex items-end gap-2"><input type="checkbox" checked={it.is_active} onChange={(e) => setIt({ ...it, is_active: e.target.checked })} />{ar ? "نشط" : "Active"}</label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground inline-flex items-center gap-1"><Save className="h-3 w-3" />{ar ? "حفظ" : "Save"}</button>
        <button onClick={remove} className="rounded border border-border px-3 py-1 text-xs text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" />{ar ? "حذف" : "Delete"}</button>
      </div>
    </div>
  );
}

/* -------------------- Announcements -------------------- */
function AnnouncementsPanel({ ar }: { ar: boolean }) {
  const [items, setItems] = useState<AnnouncementMessage[]>([]);
  const reload = () => fetchAnnouncements(false).then(setItems);
  useEffect(() => { reload(); }, []);
  const add = async () => {
    const { data, error } = await supabase.from("announcement_messages").insert({
      message_ar: "إعلان جديد", message_en: "New announcement", sort_order: items.length, is_active: true,
    }).select().single();
    if (error) toast.error(error.message); else setItems([...items, data as AnnouncementMessage]);
  };
  return (
    <section className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{ar ? "رسائل الشريط المتحرك أعلى الصفحة" : "Rotating top-bar messages"}</p>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Plus className="h-3.5 w-3.5" />{ar ? "إضافة جملة" : "Add message"}</button>
      </div>
      <div className="space-y-2">
        {items.map((a) => <AnnouncementRow key={a.id} item={a} ar={ar} onChange={reload} />)}
        {items.length === 0 && <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">{ar ? "لا توجد رسائل" : "No messages"}</p>}
      </div>
    </section>
  );
}

function AnnouncementRow({ item, ar, onChange }: { item: AnnouncementMessage; ar: boolean; onChange: () => void }) {
  const [a, setA] = useState(item);
  const save = async () => {
    const { error } = await supabase.from("announcement_messages").update({
      message_ar: a.message_ar, message_en: a.message_en, sort_order: a.sort_order, is_active: a.is_active,
    }).eq("id", a.id);
    if (error) toast.error(error.message); else toast.success(ar ? "تم" : "Saved");
  };
  const remove = async () => { if (!confirm(ar ? "حذف؟" : "Delete?")) return; await supabase.from("announcement_messages").delete().eq("id", a.id); onChange(); };
  return (
    <div className="rounded border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end text-xs">
      <Input label={ar ? "بالعربي" : "Arabic"} value={a.message_ar} onChange={(v) => setA({ ...a, message_ar: v })} className="md:col-span-5" />
      <Input label={ar ? "بالإنجليزي" : "English"} value={a.message_en} onChange={(v) => setA({ ...a, message_en: v })} className="md:col-span-5" />
      <Input label={ar ? "ترتيب" : "Order"} type="number" value={String(a.sort_order)} onChange={(v) => setA({ ...a, sort_order: parseInt(v) || 0 })} className="md:col-span-1" />
      <div className="flex items-center gap-2 md:col-span-1">
        <input type="checkbox" checked={a.is_active} onChange={(e) => setA({ ...a, is_active: e.target.checked })} />
        <button onClick={save} className="rounded bg-primary px-2 py-1 text-primary-foreground"><Save className="h-3 w-3" /></button>
        <button onClick={remove} className="rounded border border-border px-2 py-1 text-destructive"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  );
}

/* -------------------- Footer & Settings -------------------- */
function FooterPanel({ ar }: { ar: boolean }) {
  const [s, setS] = useState<StorefrontSettings | null>(null);
  useEffect(() => { fetchStorefrontSettings().then(setS); }, []);
  if (!s) return <p className="text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p>;

  const save = async () => {
    const { error } = await supabase.from("storefront_settings").update({
      banner_autoplay_seconds: s.banner_autoplay_seconds,
      banner_display_mode: s.banner_display_mode,
      announcement_rotate_seconds: s.announcement_rotate_seconds,
      footer_about_ar: s.footer_about_ar, footer_about_en: s.footer_about_en,
      footer_phone: s.footer_phone, footer_email: s.footer_email,
      footer_address_ar: s.footer_address_ar, footer_address_en: s.footer_address_en,
      footer_instagram: s.footer_instagram, footer_tiktok: s.footer_tiktok, footer_whatsapp: s.footer_whatsapp,
    }).eq("id", true);
    if (error) { toast.error(error.message); return; }
    clearStorefrontSettingsCache();
    toast.success(ar ? "تم الحفظ" : "Saved");
  };

  return (
    <section className="space-y-4">
      <div className="rounded border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">{ar ? "إعدادات البانرات" : "Banner settings"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ar ? "وضع العرض" : "Display mode"}
            </span>
            <select
              value={s.banner_display_mode ?? "rotate"}
              onChange={(e) => setS({ ...s, banner_display_mode: e.target.value as "rotate" | "slider" })}
              className="rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="rotate">{ar ? "تلقائي (خلف بعض)" : "Auto-rotate (stacked)"}</option>
              <option value="slider">{ar ? "منزلق قابل للتمرير" : "Swipeable slider"}</option>
            </select>
          </label>
          <Input label={ar ? "ثواني تبديل البانر" : "Banner autoplay seconds"} type="number" value={String(s.banner_autoplay_seconds)} onChange={(v) => setS({ ...s, banner_autoplay_seconds: parseInt(v) || 5 })} />
          <Input label={ar ? "ثواني تبديل الإعلان" : "Announcement rotate seconds"} type="number" value={String(s.announcement_rotate_seconds)} onChange={(v) => setS({ ...s, announcement_rotate_seconds: parseInt(v) || 4 })} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {ar
            ? "وضع \"تلقائي\": يتبدّل البانر تلقائياً مع أزرار للتنقل. وضع \"منزلق\": يسحب المستخدم بإصبعه بين البانرات بدون تبديل تلقائي."
            : "Auto-rotate: banners change automatically with nav arrows. Slider: user swipes between banners, no auto-change."}
        </p>
      </div>

      <div className="rounded border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">{ar ? "محتوى الفوتر" : "Footer content"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <Textarea label={ar ? "نبذة (ع)" : "About AR"} value={s.footer_about_ar ?? ""} onChange={(v) => setS({ ...s, footer_about_ar: v })} />
          <Textarea label={ar ? "نبذة (En)" : "About EN"} value={s.footer_about_en ?? ""} onChange={(v) => setS({ ...s, footer_about_en: v })} />
          <Input label={ar ? "العنوان (ع)" : "Address AR"} value={s.footer_address_ar ?? ""} onChange={(v) => setS({ ...s, footer_address_ar: v })} />
          <Input label={ar ? "العنوان (En)" : "Address EN"} value={s.footer_address_en ?? ""} onChange={(v) => setS({ ...s, footer_address_en: v })} />
          <Input label={ar ? "الهاتف" : "Phone"} value={s.footer_phone ?? ""} onChange={(v) => setS({ ...s, footer_phone: v })} />
          <Input label={ar ? "البريد" : "Email"} value={s.footer_email ?? ""} onChange={(v) => setS({ ...s, footer_email: v })} />
          <Input label="Instagram URL" value={s.footer_instagram ?? ""} onChange={(v) => setS({ ...s, footer_instagram: v })} />
          <Input label="TikTok URL" value={s.footer_tiktok ?? ""} onChange={(v) => setS({ ...s, footer_tiktok: v })} />
          <Input label="WhatsApp URL" value={s.footer_whatsapp ?? ""} onChange={(v) => setS({ ...s, footer_whatsapp: v })} className="md:col-span-2" />
        </div>
      </div>

      <button onClick={save} className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
        <Save className="h-4 w-4" /> {ar ? "حفظ كل الإعدادات" : "Save all settings"}
      </button>
    </section>
  );
}

/* -------------------- Inputs -------------------- */
function Input({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
  );
}
function Textarea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="rounded border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
  );
}
