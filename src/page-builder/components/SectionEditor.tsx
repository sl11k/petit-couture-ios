import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MediaUploader } from "@/features/admin/components/MediaUploader";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Search, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LinkPicker } from "./LinkPicker";
import type {
  Section, ButtonContent, FeatureCard, FaqItem, TestimonialItem, StatItem, ImageContent,
} from "../schemas/pageSchema";

type UpdateOpts = { label?: string; key?: string };

type Props = {
  section: Section;
  onChange: (updater: (s: Section) => Section, opts?: UpdateOpts) => void;
  onConvertLegacy?: () => void;
  notify?: (label: string) => void;
};

function nid(p: string) { return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function TextField({ label, value, onChange, multiline, coalesceKey }: { label: string; value?: string; onChange: (v: string, opts?: UpdateOpts) => void; multiline?: boolean; coalesceKey?: string }) {
  const key = coalesceKey ?? `text:${label}`;
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {multiline
        ? <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value, { label: `تعديل ${label}`, key })} />
        : <Input value={value ?? ""} onChange={(e) => onChange(e.target.value, { label: `تعديل ${label}`, key })} />}
    </div>
  );
}


function ButtonsEditor({ buttons, onChange }: { buttons?: ButtonContent[]; onChange: (b: ButtonContent[]) => void }) {
  const list = buttons ?? [];
  return (
    <div className="space-y-2">
      <Label className="text-xs">الأزرار</Label>
      {list.map((b, i) => (
        <div key={i} className="rounded-md border border-border p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">زر #{i + 1}</span>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
              onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
          </div>
          <Input placeholder="نص (عربي)" value={b.label_ar ?? ""} onChange={(e) => onChange(list.map((x, j) => j === i ? { ...x, label_ar: e.target.value } : x))} />
          <Input placeholder="Label (English)" value={b.label_en ?? ""} onChange={(e) => onChange(list.map((x, j) => j === i ? { ...x, label_en: e.target.value } : x))} />
          <LinkPicker value={b.url} onChange={(url) => onChange(list.map((x, j) => j === i ? { ...x, url } : x))} placeholder="رابط الزر" />
          <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={b.variant ?? "primary"}
            onChange={(e) => onChange(list.map((x, j) => j === i ? { ...x, variant: e.target.value as any } : x))}>
            <option value="primary">أساسي</option>
            <option value="secondary">ثانوي</option>
            <option value="ghost">شفاف</option>
          </select>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={b.newTab ?? false} onCheckedChange={(v) => onChange(list.map((x, j) => j === i ? { ...x, newTab: v } : x))} />
            فتح في تبويب جديد
          </label>
        </div>
      ))}
      <Button size="sm" variant="outline" className="w-full" onClick={() => onChange([...list, { label_ar: "زر", label_en: "Button", url: "/", variant: "primary" }])}>
        <Plus className="h-3 w-3 me-1" /> إضافة زر
      </Button>
    </div>
  );
}

function ImageField({ label, value, onChange, allowLink = true }: { label: string; value?: ImageContent; onChange: (v: ImageContent) => void; allowLink?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <MediaUploader value={value?.url ?? null} onChange={(url) => onChange({ ...(value ?? {}), url: url ?? undefined })} bucket="content-media" kind="image" folder="cms" />
      <Input placeholder="Alt text" value={value?.alt ?? ""} onChange={(e) => onChange({ ...(value ?? {}), alt: e.target.value })} />
      <Input placeholder="التعليق (عربي)" value={value?.caption_ar ?? ""} onChange={(e) => onChange({ ...(value ?? {}), caption_ar: e.target.value })} />
      <Input placeholder="Caption (English)" value={value?.caption_en ?? ""} onChange={(e) => onChange({ ...(value ?? {}), caption_en: e.target.value })} />
      {allowLink && <LinkPicker value={value?.link} onChange={(link) => onChange({ ...(value ?? {}), link })} placeholder="رابط الصورة (اختياري)" />}
      {allowLink && <label className="flex items-center gap-2 text-xs">
        <Switch checked={value?.newTab ?? false} onCheckedChange={(newTab) => onChange({ ...(value ?? {}), newTab })} />
        فتح رابط الصورة في تبويب جديد
      </label>}
    </div>
  );
}

type CategoryChoice = { id: string; slug: string; name_ar: string; name_en: string; image_url: string | null };
type ProductChoice = { id: string; slug: string; name_ar: string | null; name_en: string | null; sku: string | null; image_url: string | null };

function CategoryPicker({ value, onChange }: { value?: string; onChange: (slug: string) => void }) {
  const [items, setItems] = useState<CategoryChoice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.from("categories").select("id,slug,name_ar,name_en,image_url").eq("is_active", true).order("display_order").then(({ data }) => {
      if (active) { setItems((data ?? []) as CategoryChoice[]); setLoading(false); }
    });
    return () => { active = false; };
  }, []);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">اختر التصنيف</Label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={loading} className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
        <option value="">{loading ? "جاري تحميل التصنيفات…" : "اختر تصنيفاً"}</option>
        {items.map((item) => <option key={item.id} value={item.slug}>{item.name_ar} · {item.name_en}</option>)}
      </select>
      {!loading && items.length === 0 && <p className="text-[11px] text-destructive">لا توجد تصنيفات مفعلة.</p>}
    </div>
  );
}

function ManualProductPicker({ value, onChange }: { value: string[]; onChange: (slugs: string[]) => void }) {
  const [items, setItems] = useState<ProductChoice[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      const all: ProductChoice[] = [];
      const pageSize = 1000;
      for (let from = 0; active; from += pageSize) {
        const { data } = await supabase.from("products").select("id,slug,name_ar,name_en,sku,image_url").eq("status", "active").eq("is_active", true).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
        const page = (data ?? []) as ProductChoice[];
        all.push(...page);
        if (page.length < pageSize) break;
      }
      if (active) { setItems(all); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle ? items.filter((item) => `${item.name_ar ?? ""} ${item.name_en ?? ""} ${item.sku ?? ""} ${item.slug}`.toLowerCase().includes(needle)) : items;
    return [...matches].sort((a, b) => Number(value.includes(b.slug)) - Number(value.includes(a.slug)));
  }, [items, query, value]);
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((item) => item !== slug) : [...value, slug]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><Label className="text-xs">المنتجات المختارة</Label><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{value.length} مختار</span></div>
      <div className="relative"><Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو SKU…" className="ps-8" /></div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-background">
        {loading ? <p className="p-5 text-center text-xs text-muted-foreground">جاري تحميل المنتجات…</p> : filtered.length === 0 ? <p className="p-5 text-center text-xs text-muted-foreground">لا توجد نتائج</p> : filtered.map((item) => {
          const selected = value.includes(item.slug);
          return <button type="button" key={item.id} onClick={() => toggle(item.slug)} className={`flex w-full items-center gap-2 border-b border-border p-2 text-start last:border-0 ${selected ? "bg-primary/5" : "hover:bg-muted/50"}`}>
            {item.image_url ? <img src={item.image_url} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
            <span className="min-w-0 flex-1"><b className="block truncate text-xs font-medium">{item.name_ar || item.name_en}</b><small className="block truncate text-[10px] text-muted-foreground">{item.name_en} · {item.sku || item.slug}</small></span>
            <span className={`grid h-5 w-5 place-items-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected && <Check className="h-3 w-3" />}</span>
          </button>;
        })}
      </div>
    </div>
  );
}

function SpacingFields({ s, onChange, notify }: { s: Section; onChange: Props["onChange"]; notify?: (l: string) => void }) {
  const sp = s.settings?.spacing ?? {};
  const bg = s.settings?.backgroundColor ?? "";
  const setSpacing = (k: "paddingTop" | "paddingBottom", val: number | undefined) => {
    const label = k === "paddingTop" ? `Padding Top → ${val ?? 0}px` : `Padding Bottom → ${val ?? 0}px`;
    onChange((cur) => ({ ...cur, settings: { ...(cur.settings ?? {}), spacing: { ...((cur.settings?.spacing) ?? {}), [k]: val } } } as Section),
      { label, key: `spacing:${s.id}:${k}` });
    notify?.(label);
  };
  const setBg = (val: string | undefined) => {
    const label = val ? `لون الخلفية → ${val}` : "إزالة لون الخلفية";
    onChange((cur) => ({ ...cur, settings: { ...(cur.settings ?? {}), backgroundColor: val } } as Section),
      { label, key: `bg:${s.id}` });
    notify?.(label);
  };


  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Padding Top</Label>
          <span className="text-xs text-muted-foreground">{sp.paddingTop ?? 0}px</span>
        </div>
        <input
          type="range" min={0} max={200} step={4}
          value={sp.paddingTop ?? 0}
          onChange={(e) => setSpacing("paddingTop", Number(e.target.value) || undefined)}
          className="w-full accent-primary"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Padding Bottom</Label>
          <span className="text-xs text-muted-foreground">{sp.paddingBottom ?? 0}px</span>
        </div>
        <input
          type="range" min={0} max={200} step={4}
          value={sp.paddingBottom ?? 0}
          onChange={(e) => setSpacing("paddingBottom", Number(e.target.value) || undefined)}
          className="w-full accent-primary"
        />
      </div>
      <div>
        <Label className="text-xs">لون الخلفية</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(bg) ? bg : "#ffffff"}
            onChange={(e) => setBg(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
            aria-label="اختر لون"
          />
          <Input
            placeholder="بدون لون"
            value={bg}
            onChange={(e) => setBg(e.target.value || undefined)}
            className="flex-1"
          />
          {bg && (
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setBg(undefined)} title="مسح">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function VisibilityFields({ s, onChange, notify }: { s: Section; onChange: Props["onChange"]; notify?: (l: string) => void }) {
  const v = s.settings?.visibility ?? {};
  const set = (k: "desktop" | "tablet" | "mobile", val: boolean) => {
    const dn = k === "desktop" ? "سطح المكتب" : k === "tablet" ? "تابلت" : "موبايل";
    const label = `${val ? "إظهار" : "إخفاء"} القسم على ${dn}`;
    onChange((cur) => ({ ...cur, settings: { ...(cur.settings ?? {}), visibility: { ...(((cur.settings as any)?.visibility) ?? {}), [k]: val } } } as Section),
      { label, key: `vis:${s.id}:${k}` });
    notify?.(label);
  };


  return (
    <div className="space-y-2">
      <Label className="text-xs">الظهور</Label>
      {(["desktop", "tablet", "mobile"] as const).map((d) => (
        <label key={d} className="flex items-center justify-between text-xs">
          <span>{d === "desktop" ? "سطح المكتب" : d === "tablet" ? "تابلت" : "موبايل"}</span>
          <Switch checked={v[d] !== false} onCheckedChange={(val) => set(d, val)} />
        </label>
      ))}
    </div>
  );
}

export function SectionEditor({ section, onChange, onConvertLegacy, notify }: Props) {
  const s = section;

  function updateContent(patch: Record<string, any>, opts?: UpdateOpts): void;
  function updateContent(fn: (c: any) => Record<string, any>, opts?: UpdateOpts): void;
  function updateContent(patchOrFn: any, opts?: UpdateOpts): void {
    onChange((cur: Section) => {
      const c: any = (cur as any).content ?? {};
      const patch = typeof patchOrFn === "function" ? patchOrFn(c) : patchOrFn;
      return { ...cur, content: { ...c, ...patch } } as Section;
    }, opts);
  }





  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <span className="text-xs px-2 py-1 rounded bg-muted">{s.type}</span>
      </div>

      {s.type === "hero" && (
        <>
          <TextField label="Eyebrow (ع)" value={s.content.eyebrow_ar} onChange={(v, opts) => updateContent({ eyebrow_ar: v }, opts)} />
          <TextField label="Eyebrow (EN)" value={s.content.eyebrow_en} onChange={(v, opts) => updateContent({ eyebrow_en: v }, opts)} />
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="العنوان الفرعي (ع)" multiline value={s.content.subtitle_ar} onChange={(v, opts) => updateContent({ subtitle_ar: v }, opts)} />
          <TextField label="Subtitle (EN)" multiline value={s.content.subtitle_en} onChange={(v, opts) => updateContent({ subtitle_en: v }, opts)} />
          <div>
            <Label className="text-xs">المحاذاة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.alignment ?? "center"}
              onChange={(e) => updateContent({ alignment: e.target.value })}>
              <option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">تخطيط الواجهة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.layout ?? "overlay"} onChange={(e) => updateContent({ layout: e.target.value })}>
              <option value="overlay">النص فوق الصورة</option><option value="split">صورة ونص منقسمان</option>
            </select>
          </div>
          <ImageField label="صورة الخلفية" value={s.content.image} onChange={(v) => updateContent({ image: v })} allowLink={false} />
          <ButtonsEditor buttons={s.content.buttons} onChange={(b) => updateContent({ buttons: b })} />
        </>
      )}

      {s.type === "text_block" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="النص (ع)" multiline value={s.content.body_ar} onChange={(v, opts) => updateContent({ body_ar: v }, opts)} />
          <TextField label="Body (EN)" multiline value={s.content.body_en} onChange={(v, opts) => updateContent({ body_en: v }, opts)} />
          <div><Label className="text-xs">المحاذاة</Label><select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.alignment ?? "left"} onChange={(e) => updateContent({ alignment: e.target.value })}><option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option></select></div>
          <ButtonsEditor buttons={s.content.buttons} onChange={(buttons) => updateContent({ buttons })} />
        </>
      )}

      {s.type === "image_text" && (
        <>
          <ImageField label="الصورة" value={s.content.image} onChange={(v) => updateContent({ image: v })} />
          <div>
            <Label className="text-xs">جانب الصورة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.imageSide ?? "left"}
              onChange={(e) => updateContent({ imageSide: e.target.value })}>
              <option value="left">يسار</option><option value="right">يمين</option>
            </select>
          </div>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="النص (ع)" multiline value={s.content.body_ar} onChange={(v, opts) => updateContent({ body_ar: v }, opts)} />
          <TextField label="Body (EN)" multiline value={s.content.body_en} onChange={(v, opts) => updateContent({ body_en: v }, opts)} />
          <ButtonsEditor
            buttons={s.content.button ? [s.content.button] : []}
            onChange={(buttons) => updateContent({ button: buttons[0] })}
          />
        </>
      )}

      {s.type === "feature_grid" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="الوصف الفرعي (عربي)" value={s.content.subtitle_ar} onChange={(v, opts) => updateContent({ subtitle_ar: v }, opts)} />
          <TextField label="Subtitle (English)" value={s.content.subtitle_en} onChange={(v, opts) => updateContent({ subtitle_en: v }, opts)} />
          <div>
            <Label className="text-xs">عدد الأعمدة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.columns ?? 3}
              onChange={(e) => updateContent({ columns: Number(e.target.value) })}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">البطاقات</Label>
            {s.content.cards.map((c, i) => (
              <div key={c.id} className="rounded-md border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">بطاقة #{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                    onClick={() => updateContent((ct: any) => ({ cards: ct.cards.filter((x: any) => x.id !== c.id) }))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="عنوان (ع)" value={c.title_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, title_ar: e.target.value } : x) }))} />
                <Input placeholder="Title (EN)" value={c.title_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, title_en: e.target.value } : x) }))} />
                <Textarea rows={2} placeholder="وصف (ع)" value={c.description_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, description_ar: e.target.value } : x) }))} />
                <Textarea rows={2} placeholder="Description (EN)" value={c.description_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, description_en: e.target.value } : x) }))} />
                <Input placeholder="أيقونة أو رمز مثل ✦" value={c.icon ?? ""} onChange={(e) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, icon: e.target.value } : x) }))} />
                <ImageField label="صورة البطاقة" value={c.image} onChange={(image) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, image } : x) }))} />
                <LinkPicker value={c.link} onChange={(url) => updateContent((ct: any) => ({ cards: ct.cards.map((x: any) => x.id === c.id ? { ...x, link: url } : x) }))} placeholder="رابط البطاقة" />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent((ct: any) => ({ cards: [...ct.cards, { id: nid("card"), title_ar: "بطاقة", title_en: "Card", description_ar: "", description_en: "" } as FeatureCard] }))}>
              <Plus className="h-3 w-3 me-1" /> إضافة بطاقة
            </Button>
          </div>
        </>
      )}

      {s.type === "faq" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div className="space-y-2">
            <Label className="text-xs">الأسئلة</Label>
            {s.content.items.map((it, i) => (
              <div key={it.id} className="rounded-md border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                    onClick={() => updateContent((ct: any) => ({ items: ct.items.filter((x: any) => x.id !== it.id) }))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="سؤال (ع)" value={it.question_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, question_ar: e.target.value } : x) }))} />
                <Input placeholder="Question (EN)" value={it.question_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, question_en: e.target.value } : x) }))} />
                <Textarea rows={2} placeholder="إجابة (ع)" value={it.answer_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, answer_ar: e.target.value } : x) }))} />
                <Textarea rows={2} placeholder="Answer (EN)" value={it.answer_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, answer_en: e.target.value } : x) }))} />
                <LinkPicker value={it.link} onChange={(link) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, link } : x) }))} placeholder="رابط إضافي للإجابة" />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent((ct: any) => ({ items: [...ct.items, { id: nid("q"), question_ar: "سؤال؟", question_en: "Question?", answer_ar: "", answer_en: "" } as FaqItem] }))}>
              <Plus className="h-3 w-3 me-1" /> إضافة سؤال
            </Button>
          </div>
        </>
      )}

      {s.type === "testimonials" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div className="space-y-2">
            <Label className="text-xs">الآراء</Label>
            {s.content.items.map((it, i) => (
              <div key={it.id} className="rounded-md border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                    onClick={() => updateContent((ct: any) => ({ items: ct.items.filter((x: any) => x.id !== it.id) }))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="الاسم" value={it.name ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, name: e.target.value } : x) }))} />
                <Input placeholder="الدور (ع)" value={it.role_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, role_ar: e.target.value } : x) }))} />
                <Input placeholder="Role (EN)" value={it.role_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, role_en: e.target.value } : x) }))} />
                <Textarea rows={2} placeholder="الاقتباس (ع)" value={it.quote_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, quote_ar: e.target.value } : x) }))} />
                <Textarea rows={2} placeholder="Quote (EN)" value={it.quote_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, quote_en: e.target.value } : x) }))} />
                <MediaUploader value={it.avatar ?? null} onChange={(url) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, avatar: url ?? undefined } : x) }))} bucket="content-media" kind="image" folder="cms/avatars" />
                <LinkPicker value={it.link} onChange={(link) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, link } : x) }))} placeholder="رابط العميل أو القصة" />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent((ct: any) => ({ items: [...ct.items, { id: nid("t"), name: "", quote_ar: "", quote_en: "" } as TestimonialItem] }))}>
              <Plus className="h-3 w-3 me-1" /> إضافة رأي
            </Button>
          </div>
        </>
      )}

      {s.type === "reviews" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div>
            <Label className="text-xs">عدد التقييمات</Label>
            <Input type="number" min={1} max={24} value={s.content.limit ?? 6}
              onChange={(e) => updateContent({ limit: Math.max(1, Math.min(24, Number(e.target.value) || 6)) })} />
          </div>
          <div>
            <Label className="text-xs">أقل تقييم يظهر (نجوم)</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={s.content.minRating ?? 4}
              onChange={(e) => updateContent({ minRating: Number(e.target.value) })}>
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} ★ فأكثر</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">عدد الأعمدة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={s.content.columns ?? 3}
              onChange={(e) => updateContent({ columns: Number(e.target.value) as 2 | 3 | 4 })}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </div>
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded p-2">
            يعرض تلقائياً التقييمات المعتمدة من <strong>إدارة التقييمات</strong>. أضف تقييمات بحالة "مقبول" لتظهر هنا.
          </div>
        </>
      )}

      {s.type === "stats" && (
        <div className="space-y-2">
          <Label className="text-xs">العناصر</Label>
          {s.content.items.map((it, i) => (
            <div key={it.id} className="rounded-md border border-border p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">#{i + 1}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                  onClick={() => updateContent((ct: any) => ({ items: ct.items.filter((x: any) => x.id !== it.id) }))}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <Input placeholder="القيمة (مثل 100+)" value={it.value ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, value: e.target.value } : x) }))} />
              <Input placeholder="التسمية (ع)" value={it.label_ar ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, label_ar: e.target.value } : x) }))} />
              <Input placeholder="Label (EN)" value={it.label_en ?? ""} onChange={(e) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, label_en: e.target.value } : x) }))} />
              <LinkPicker value={it.link} onChange={(link) => updateContent((ct: any) => ({ items: ct.items.map((x: any) => x.id === it.id ? { ...x, link } : x) }))} placeholder="رابط العنصر" />
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent((ct: any) => ({ items: [...ct.items, { id: nid("st"), value: "0", label_ar: "", label_en: "" } as StatItem] }))}>
            <Plus className="h-3 w-3 me-1" /> إضافة
          </Button>
        </div>
      )}

      {s.type === "gallery" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div>
            <Label className="text-xs">عدد الأعمدة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.columns ?? 3}
              onChange={(e) => updateContent({ columns: Number(e.target.value) })}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">الصور</Label>
            {s.content.images.map((im, i) => (
              <div key={i} className="rounded-md border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                    onClick={() => updateContent((c: any) => ({ images: c.images.filter((_: any, j: any) => j !== i) }))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <ImageField label="الصورة" value={im} onChange={(image) => updateContent((c: any) => ({ images: c.images.map((x: any, j: any) => j === i ? image : x) }))} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent((c: any) => ({ images: [...c.images, {}] }))}><Plus className="h-3 w-3 me-1" /> إضافة صورة</Button>
          </div>
        </>
      )}

      {s.type === "before_after" && (
        <>
          <TextField label="العنوان (عربي)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (English)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="font-medium text-xs">صورة قبل</div>
            <ImageField label="ارفع صورة قبل" value={s.content.beforeImage} onChange={(v) => updateContent({ beforeImage: v })} allowLink={false} />
            <TextField label="تسمية قبل (عربي)" value={s.content.beforeLabel_ar} onChange={(v, opts) => updateContent({ beforeLabel_ar: v }, opts)} />
            <TextField label="Before label (English)" value={s.content.beforeLabel_en} onChange={(v, opts) => updateContent({ beforeLabel_en: v }, opts)} />
          </div>
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="font-medium text-xs">صورة بعد</div>
            <ImageField label="ارفع صورة بعد" value={s.content.afterImage} onChange={(v) => updateContent({ afterImage: v })} allowLink={false} />
            <TextField label="تسمية بعد (عربي)" value={s.content.afterLabel_ar} onChange={(v, opts) => updateContent({ afterLabel_ar: v }, opts)} />
            <TextField label="After label (English)" value={s.content.afterLabel_en} onChange={(v, opts) => updateContent({ afterLabel_en: v }, opts)} />
          </div>
          <div>
            <Label className="text-xs">طريقة العرض</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={s.content.layout ?? "slider"}
              onChange={(e) => updateContent({ layout: e.target.value })}>
              <option value="slider">سحب للمقارنة</option>
              <option value="side_by_side">صورتان جنباً إلى جنب</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">ارتفاع الصور</Label>
              <span className="text-xs text-muted-foreground">{s.content.imageHeight ?? 520}px</span>
            </div>
            <input type="range" min={240} max={800} step={20} value={s.content.imageHeight ?? 520}
              onChange={(e) => updateContent({ imageHeight: Number(e.target.value) })}
              className="w-full accent-primary" />
          </div>
        </>
      )}

      {s.type === "video" && (
        <>
          <TextField label="العنوان (عربي)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (English)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div className="space-y-1">
            <Label className="text-xs">ملف الفيديو</Label>
            <MediaUploader value={s.content.videoUrl ?? null} onChange={(url) => updateContent({ videoUrl: url ?? "" })} bucket="content-media" kind="video" folder="cms/video" />
            <Input placeholder="أو رابط MP4 / WebM مباشر" value={s.content.videoUrl ?? ""} onChange={(e) => updateContent({ videoUrl: e.target.value })} />
          </div>
          <ImageField label="صورة الغلاف" value={s.content.poster} onChange={(poster) => updateContent({ poster })} allowLink={false} />
          <TextField label="وصف الفيديو (عربي)" value={s.content.caption_ar} onChange={(v, opts) => updateContent({ caption_ar: v }, opts)} />
          <TextField label="Video caption (English)" value={s.content.caption_en} onChange={(v, opts) => updateContent({ caption_en: v }, opts)} />
          <LinkPicker value={s.content.link} onChange={(link) => updateContent({ link })} placeholder="رابط عند الضغط على الفيديو" />
          <div>
            <Label className="text-xs">نسبة العرض</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.aspectRatio ?? "16/9"} onChange={(e) => updateContent({ aspectRatio: e.target.value })}>
              <option value="16/9">16:9</option><option value="4/3">4:3</option><option value="1/1">1:1</option><option value="9/16">9:16</option>
            </select>
          </div>
          {([['controls', 'إظهار أدوات التشغيل'], ['autoplay', 'تشغيل تلقائي'], ['muted', 'كتم الصوت'], ['loop', 'تكرار الفيديو']] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between text-xs"><span>{label}</span><Switch checked={s.content[key] ?? (key === 'controls' || key === 'muted')} onCheckedChange={(value) => updateContent({ [key]: value })} /></label>
          ))}
        </>
      )}

      {s.type === "countdown" && (
        <>
          <TextField label="العنوان (عربي)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (English)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="الوصف (عربي)" value={s.content.subtitle_ar} onChange={(v, opts) => updateContent({ subtitle_ar: v }, opts)} />
          <TextField label="Subtitle (English)" value={s.content.subtitle_en} onChange={(v, opts) => updateContent({ subtitle_en: v }, opts)} />
          <div><Label className="text-xs">موعد انتهاء العد</Label><Input type="datetime-local" value={s.content.targetDate?.slice(0, 16) ?? ""} onChange={(e) => updateContent({ targetDate: e.target.value ? new Date(e.target.value).toISOString() : "" })} /></div>
          <TextField label="النص بعد الانتهاء (عربي)" value={s.content.expiredText_ar} onChange={(v, opts) => updateContent({ expiredText_ar: v }, opts)} />
          <TextField label="Expired text (English)" value={s.content.expiredText_en} onChange={(v, opts) => updateContent({ expiredText_en: v }, opts)} />
          <ImageField label="صورة الخلفية" value={s.content.backgroundImage} onChange={(backgroundImage) => updateContent({ backgroundImage })} allowLink={false} />
          <ButtonsEditor buttons={s.content.button ? [s.content.button] : []} onChange={(buttons) => updateContent({ button: buttons[0] })} />
        </>
      )}

      {s.type === "newsletter" && (
        <>
          <TextField label="العنوان (عربي)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (English)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="الوصف (عربي)" value={s.content.subtitle_ar} onChange={(v, opts) => updateContent({ subtitle_ar: v }, opts)} />
          <TextField label="Subtitle (English)" value={s.content.subtitle_en} onChange={(v, opts) => updateContent({ subtitle_en: v }, opts)} />
          <TextField label="نص حقل البريد (عربي)" value={s.content.placeholder_ar} onChange={(v, opts) => updateContent({ placeholder_ar: v }, opts)} />
          <TextField label="Email placeholder (English)" value={s.content.placeholder_en} onChange={(v, opts) => updateContent({ placeholder_en: v }, opts)} />
          <TextField label="نص الزر (عربي)" value={s.content.buttonLabel_ar} onChange={(v, opts) => updateContent({ buttonLabel_ar: v }, opts)} />
          <TextField label="Button label (English)" value={s.content.buttonLabel_en} onChange={(v, opts) => updateContent({ buttonLabel_en: v }, opts)} />
          <TextField label="رسالة النجاح (عربي)" value={s.content.successText_ar} onChange={(v, opts) => updateContent({ successText_ar: v }, opts)} />
          <TextField label="Success message (English)" value={s.content.successText_en} onChange={(v, opts) => updateContent({ successText_en: v }, opts)} />
          <LinkPicker value={s.content.privacyUrl} onChange={(privacyUrl) => updateContent({ privacyUrl })} placeholder="رابط سياسة الخصوصية" />
          <Input value={s.content.actionUrl ?? ""} onChange={(e) => updateContent({ actionUrl: e.target.value })} placeholder="Webhook اختياري لاستقبال البريد" />
          <ImageField label="صورة الخلفية" value={s.content.backgroundImage} onChange={(backgroundImage) => updateContent({ backgroundImage })} allowLink={false} />
        </>
      )}

      {s.type === "cta" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="الوصف (ع)" multiline value={s.content.subtitle_ar} onChange={(v, opts) => updateContent({ subtitle_ar: v }, opts)} />
          <TextField label="Subtitle (EN)" multiline value={s.content.subtitle_en} onChange={(v, opts) => updateContent({ subtitle_en: v }, opts)} />
          <div><Label className="text-xs">المحاذاة</Label><select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.alignment ?? "center"} onChange={(e) => updateContent({ alignment: e.target.value })}><option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option></select></div>
          <ButtonsEditor buttons={s.content.buttons} onChange={(b) => updateContent({ buttons: b })} />
        </>
      )}

      {s.type === "button" && (
        <>
          <Input placeholder="نص (ع)" value={s.content.button?.label_ar ?? ""} onChange={(e) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), label_ar: e.target.value } }))} />
          <Input placeholder="Label (EN)" value={s.content.button?.label_en ?? ""} onChange={(e) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), label_en: e.target.value } }))} />
          <LinkPicker value={s.content.button?.url} onChange={(url) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), url } }))} placeholder="رابط الزر" />
          <div>
            <Label className="text-xs">نمط</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.button?.variant ?? "primary"}
              onChange={(e) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), variant: e.target.value } }))}>
              <option value="primary">أساسي</option><option value="secondary">ثانوي</option><option value="ghost">شفاف</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">الحجم</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.size ?? "md"}
              onChange={(e) => updateContent({ size: e.target.value })}>
              <option value="sm">صغير</option><option value="md">متوسط</option><option value="lg">كبير</option><option value="xl">ضخم</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">الشكل</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.shape ?? "rounded"}
              onChange={(e) => updateContent({ shape: e.target.value })}>
              <option value="square">مربع</option><option value="rounded">دائري الزوايا</option><option value="pill">بيضاوي</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">المحاذاة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.alignment ?? "center"}
              onChange={(e) => updateContent({ alignment: e.target.value })}>
              <option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={s.content.fullWidth ?? false} onCheckedChange={(v) => updateContent({ fullWidth: v })} />
            عرض كامل
          </label>
        </>
      )}

      {s.type === "banner" && (
        <>
          <ImageField label="صورة الخلفية" value={s.content.image} onChange={(v) => updateContent({ image: v })} allowLink={false} />
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <TextField label="الفرعي (ع)" multiline value={s.content.subtitle_ar} onChange={(v, opts) => updateContent({ subtitle_ar: v }, opts)} />
          <TextField label="Subtitle (EN)" multiline value={s.content.subtitle_en} onChange={(v, opts) => updateContent({ subtitle_en: v }, opts)} />
          <div className="rounded-md border border-border p-2 space-y-2">
            <Label className="text-xs">زر CTA</Label>
            <Input placeholder="نص (ع)" value={s.content.button?.label_ar ?? ""} onChange={(e) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), label_ar: e.target.value } }))} />
            <Input placeholder="Label (EN)" value={s.content.button?.label_en ?? ""} onChange={(e) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), label_en: e.target.value } }))} />
            <LinkPicker value={s.content.button?.url} onChange={(url) => updateContent((c: any) => ({ button: { ...(c.button ?? {}), url } }))} placeholder="الرابط" />
          </div>
          <div>
            <Label className="text-xs">الارتفاع</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.height ?? "md"}
              onChange={(e) => updateContent({ height: e.target.value })}>
              <option value="sm">قصير</option><option value="md">متوسط</option><option value="lg">طويل</option><option value="xl">ضخم</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">الشكل</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.shape ?? "rounded"}
              onChange={(e) => updateContent({ shape: e.target.value })}>
              <option value="square">حواف حادة</option><option value="rounded">حواف ناعمة</option><option value="pill">بيضاوي</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between"><Label className="text-xs">شفافية التغطية</Label><span className="text-xs text-muted-foreground">{Math.round((s.content.overlay ?? 0.35) * 100)}%</span></div>
            <input type="range" min={0} max={1} step={0.05} value={s.content.overlay ?? 0.35}
              onChange={(e) => updateContent({ overlay: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <div>
            <Label className="text-xs">لون النص</Label>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(s.content.textColor ?? "") ? s.content.textColor : "#ffffff"}
              onChange={(e) => updateContent({ textColor: e.target.value })} className="h-9 w-full rounded border border-border" />
          </div>
        </>
      )}

      {s.type === "product_grid" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v, opts) => updateContent({ title_ar: v }, opts)} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v, opts) => updateContent({ title_en: v }, opts)} />
          <div>
            <Label className="text-xs">المصدر</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.source ?? "newest"}
              onChange={(e) => updateContent({ source: e.target.value })}>
              <option value="newest">أحدث المنتجات</option>
              <option value="best_sellers">الأكثر مبيعاً تلقائياً</option>
              <option value="sale">منتجات التخفيض تلقائياً</option>
              <option value="category">من تصنيف</option>
              <option value="manual">منتجات مختارة</option>
            </select>
          </div>
          {s.content.source === "category" && (
            <CategoryPicker value={s.content.categorySlug} onChange={(categorySlug) => updateContent({ categorySlug })} />
          )}
          {s.content.source === "manual" && (
            <ManualProductPicker value={s.content.productSlugs ?? []} onChange={(productSlugs) => updateContent({ productSlugs })} />
          )}
          <div>
            <Label className="text-xs">العدد الأقصى</Label>
            <Input type="number" min={1} max={48} value={s.content.limit ?? 8}
              onChange={(e) => updateContent({ limit: Math.max(1, Math.min(48, Number(e.target.value) || 8)) })} />
          </div>
          <div>
            <Label className="text-xs">طريقة عرض المنتجات</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.layout ?? "grid"} onChange={(e) => updateContent({ layout: e.target.value })}>
              <option value="carousel">صف واحد قابل للسحب يميناً ويساراً</option>
              <option value="grid">شبكة متعددة الصفوف تحت بعضها</option>
            </select>
          </div>
          {(s.content.layout ?? "grid") === "grid" && <div>
            <Label className="text-xs">عدد الأعمدة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.columns ?? 4}
              onChange={(e) => updateContent({ columns: Number(e.target.value) })}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
            </select>
          </div>}
          {s.content.layout === "carousel" && <>
            <div>
              <Label className="text-xs">حجم بطاقة المنتج</Label>
              <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.carouselCardSize ?? "medium"} onChange={(e) => updateContent({ carouselCardSize: e.target.value })}>
                <option value="compact">صغير — منتجات أكثر ظاهرة</option><option value="medium">متوسط</option><option value="large">كبير</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs"><Switch checked={s.content.showNavigation !== false} onCheckedChange={(showNavigation) => updateContent({ showNavigation })} />إظهار أسهم التنقل</label>
          </>}
          <div>
            <Label className="text-xs">شكل البطاقة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.cardShape ?? "rounded"}
              onChange={(e) => updateContent({ cardShape: e.target.value })}>
              <option value="square">حواف حادة</option><option value="rounded">حواف ناعمة</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={s.content.showPrice !== false} onCheckedChange={(v) => updateContent({ showPrice: v })} />
            إظهار السعر
          </label>
        </>
      )}

      {s.type === "divider" && (
        <>
          <div>
            <Label className="text-xs">النمط</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.style ?? "solid"}
              onChange={(e) => updateContent({ style: e.target.value })}>
              <option value="solid">صلب</option><option value="dashed">متقطع</option><option value="dotted">منقّط</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">السماكة (px)</Label>
            <Input type="number" min={1} max={20} value={s.content.thickness ?? 1}
              onChange={(e) => updateContent({ thickness: Number(e.target.value) || 1 })} />
          </div>
          <div>
            <Label className="text-xs">العرض %</Label>
            <input type="range" min={10} max={100} value={s.content.width ?? 100}
              onChange={(e) => updateContent({ width: Number(e.target.value) })} className="w-full accent-primary" />
            <span className="text-xs text-muted-foreground">{s.content.width ?? 100}%</span>
          </div>
          <div>
            <Label className="text-xs">اللون</Label>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(s.content.color ?? "") ? s.content.color : "#e5e7eb"}
              onChange={(e) => updateContent({ color: e.target.value })} className="h-9 w-full rounded border border-border" />
          </div>
        </>
      )}

      {s.type === "spacer" && (
        <div>
          <div className="flex items-center justify-between"><Label className="text-xs">الارتفاع</Label><span className="text-xs text-muted-foreground">{s.content.height ?? 40}px</span></div>
          <input type="range" min={4} max={300} step={4} value={s.content.height ?? 40}
            onChange={(e) => updateContent({ height: Number(e.target.value) })} className="w-full accent-primary" />
        </div>
      )}

      {s.type === "html" && (
        <>
          <Label className="text-xs">HTML</Label>
          <Textarea rows={12} className="font-mono text-xs" value={s.content.html ?? ""}
            onChange={(e) => updateContent({ html: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">⚠️ HTML يُحقن مباشرة في الصفحة — استخدم بحذر.</p>
        </>
      )}

      {s.type === "legacy_home" && (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-2">
            <p className="font-medium">هذا قسم نظام يعرض تصميم الصفحة الرئيسية الحالية كاملاً.</p>
            <p className="text-muted-foreground">لتعديل كل عنصر بشكل منفصل (عنوان، صور، أزرار، بطاقات...)، حوّله إلى أقسام قابلة للتعديل.</p>
          </div>
          {onConvertLegacy && (
            <Button size="sm" className="w-full" onClick={onConvertLegacy}>
              <Sparkles className="h-3.5 w-3.5 me-1" /> تحويل إلى أقسام قابلة للتعديل
            </Button>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <h4 className="font-medium mb-2 text-xs">المسافات والخلفية</h4>
        <SpacingFields s={s} onChange={onChange} notify={notify} />
      </div>

      <div className="pt-3 border-t border-border">
        <VisibilityFields s={s} onChange={onChange} notify={notify} />
      </div>
    </div>
  );
}
