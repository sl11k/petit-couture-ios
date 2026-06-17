import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MediaUploader } from "@/features/admin/components/MediaUploader";
import { Plus, Trash2 } from "lucide-react";
import type {
  Section, ButtonContent, FeatureCard, FaqItem, TestimonialItem, StatItem, ImageContent,
} from "../schemas/pageSchema";

type Props = {
  section: Section;
  onChange: (updater: (s: Section) => Section) => void;
};

function nid(p: string) { return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function TextField({ label, value, onChange, multiline }: { label: string; value?: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {multiline
        ? <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        : <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />}
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
          <Input placeholder="رابط (URL)" value={b.url ?? ""} onChange={(e) => onChange(list.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
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

function ImageField({ label, value, onChange }: { label: string; value?: ImageContent; onChange: (v: ImageContent) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <MediaUploader value={value?.url ?? null} onChange={(url) => onChange({ ...(value ?? {}), url: url ?? undefined })} bucket="content-media" kind="image" folder="cms" />
      <Input placeholder="Alt text" value={value?.alt ?? ""} onChange={(e) => onChange({ ...(value ?? {}), alt: e.target.value })} />
    </div>
  );
}

function SpacingFields({ s, onChange }: { s: Section; onChange: Props["onChange"] }) {
  const sp = s.settings?.spacing ?? {};
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label className="text-xs">Padding Top</Label>
        <Input type="number" value={sp.paddingTop ?? ""} onChange={(e) => onChange((cur) => ({ ...cur, settings: { ...cur.settings, spacing: { ...sp, paddingTop: e.target.value ? Number(e.target.value) : undefined } } } as Section))} />
      </div>
      <div>
        <Label className="text-xs">Padding Bottom</Label>
        <Input type="number" value={sp.paddingBottom ?? ""} onChange={(e) => onChange((cur) => ({ ...cur, settings: { ...cur.settings, spacing: { ...sp, paddingBottom: e.target.value ? Number(e.target.value) : undefined } } } as Section))} />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">لون الخلفية</Label>
        <Input type="text" placeholder="#fff أو hsl(...)" value={s.settings?.backgroundColor ?? ""} onChange={(e) => onChange((cur) => ({ ...cur, settings: { ...cur.settings, backgroundColor: e.target.value || undefined } } as Section))} />
      </div>
    </div>
  );
}

function VisibilityFields({ s, onChange }: { s: Section; onChange: Props["onChange"] }) {
  const v = s.settings?.visibility ?? {};
  const set = (k: "desktop" | "tablet" | "mobile", val: boolean) =>
    onChange((cur) => ({ ...cur, settings: { ...cur.settings, visibility: { ...v, [k]: val } } } as Section));
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

export function SectionEditor({ section, onChange }: Props) {
  const s = section;

  const updateContent = (patch: any) =>
    onChange((cur) => ({ ...cur, content: { ...(cur as any).content, ...patch } } as Section));

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <span className="text-xs px-2 py-1 rounded bg-muted">{s.type}</span>
      </div>

      {s.type === "hero" && (
        <>
          <TextField label="Eyebrow (ع)" value={s.content.eyebrow_ar} onChange={(v) => updateContent({ eyebrow_ar: v })} />
          <TextField label="Eyebrow (EN)" value={s.content.eyebrow_en} onChange={(v) => updateContent({ eyebrow_en: v })} />
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
          <TextField label="العنوان الفرعي (ع)" multiline value={s.content.subtitle_ar} onChange={(v) => updateContent({ subtitle_ar: v })} />
          <TextField label="Subtitle (EN)" multiline value={s.content.subtitle_en} onChange={(v) => updateContent({ subtitle_en: v })} />
          <div>
            <Label className="text-xs">المحاذاة</Label>
            <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={s.content.alignment ?? "center"}
              onChange={(e) => updateContent({ alignment: e.target.value })}>
              <option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option>
            </select>
          </div>
          <ImageField label="صورة الخلفية" value={s.content.image} onChange={(v) => updateContent({ image: v })} />
          <ButtonsEditor buttons={s.content.buttons} onChange={(b) => updateContent({ buttons: b })} />
        </>
      )}

      {s.type === "text_block" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
          <TextField label="النص (ع)" multiline value={s.content.body_ar} onChange={(v) => updateContent({ body_ar: v })} />
          <TextField label="Body (EN)" multiline value={s.content.body_en} onChange={(v) => updateContent({ body_en: v })} />
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
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
          <TextField label="النص (ع)" multiline value={s.content.body_ar} onChange={(v) => updateContent({ body_ar: v })} />
          <TextField label="Body (EN)" multiline value={s.content.body_en} onChange={(v) => updateContent({ body_en: v })} />
        </>
      )}

      {s.type === "feature_grid" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
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
                    onClick={() => updateContent({ cards: s.content.cards.filter((x) => x.id !== c.id) })}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="عنوان (ع)" value={c.title_ar ?? ""} onChange={(e) => updateContent({ cards: s.content.cards.map((x) => x.id === c.id ? { ...x, title_ar: e.target.value } : x) })} />
                <Input placeholder="Title (EN)" value={c.title_en ?? ""} onChange={(e) => updateContent({ cards: s.content.cards.map((x) => x.id === c.id ? { ...x, title_en: e.target.value } : x) })} />
                <Textarea rows={2} placeholder="وصف (ع)" value={c.description_ar ?? ""} onChange={(e) => updateContent({ cards: s.content.cards.map((x) => x.id === c.id ? { ...x, description_ar: e.target.value } : x) })} />
                <Textarea rows={2} placeholder="Description (EN)" value={c.description_en ?? ""} onChange={(e) => updateContent({ cards: s.content.cards.map((x) => x.id === c.id ? { ...x, description_en: e.target.value } : x) })} />
                <Input placeholder="رابط" value={c.link ?? ""} onChange={(e) => updateContent({ cards: s.content.cards.map((x) => x.id === c.id ? { ...x, link: e.target.value } : x) })} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent({ cards: [...s.content.cards, { id: nid("card"), title_ar: "بطاقة", title_en: "Card", description_ar: "", description_en: "" } as FeatureCard] })}>
              <Plus className="h-3 w-3 me-1" /> إضافة بطاقة
            </Button>
          </div>
        </>
      )}

      {s.type === "faq" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
          <div className="space-y-2">
            <Label className="text-xs">الأسئلة</Label>
            {s.content.items.map((it, i) => (
              <div key={it.id} className="rounded-md border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                    onClick={() => updateContent({ items: s.content.items.filter((x) => x.id !== it.id) })}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="سؤال (ع)" value={it.question_ar ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, question_ar: e.target.value } : x) })} />
                <Input placeholder="Question (EN)" value={it.question_en ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, question_en: e.target.value } : x) })} />
                <Textarea rows={2} placeholder="إجابة (ع)" value={it.answer_ar ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, answer_ar: e.target.value } : x) })} />
                <Textarea rows={2} placeholder="Answer (EN)" value={it.answer_en ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, answer_en: e.target.value } : x) })} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent({ items: [...s.content.items, { id: nid("q"), question_ar: "سؤال؟", question_en: "Question?", answer_ar: "", answer_en: "" } as FaqItem] })}>
              <Plus className="h-3 w-3 me-1" /> إضافة سؤال
            </Button>
          </div>
        </>
      )}

      {s.type === "testimonials" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
          <div className="space-y-2">
            <Label className="text-xs">الآراء</Label>
            {s.content.items.map((it, i) => (
              <div key={it.id} className="rounded-md border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                    onClick={() => updateContent({ items: s.content.items.filter((x) => x.id !== it.id) })}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="الاسم" value={it.name ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, name: e.target.value } : x) })} />
                <Input placeholder="الدور (ع)" value={it.role_ar ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, role_ar: e.target.value } : x) })} />
                <Input placeholder="Role (EN)" value={it.role_en ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, role_en: e.target.value } : x) })} />
                <Textarea rows={2} placeholder="الاقتباس (ع)" value={it.quote_ar ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, quote_ar: e.target.value } : x) })} />
                <Textarea rows={2} placeholder="Quote (EN)" value={it.quote_en ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, quote_en: e.target.value } : x) })} />
                <MediaUploader value={it.avatar ?? null} onChange={(url) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, avatar: url ?? undefined } : x) })} bucket="content-media" kind="image" folder="cms/avatars" />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent({ items: [...s.content.items, { id: nid("t"), name: "", quote_ar: "", quote_en: "" } as TestimonialItem] })}>
              <Plus className="h-3 w-3 me-1" /> إضافة رأي
            </Button>
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
                  onClick={() => updateContent({ items: s.content.items.filter((x) => x.id !== it.id) })}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <Input placeholder="القيمة (مثل 100+)" value={it.value ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, value: e.target.value } : x) })} />
              <Input placeholder="التسمية (ع)" value={it.label_ar ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, label_ar: e.target.value } : x) })} />
              <Input placeholder="Label (EN)" value={it.label_en ?? ""} onChange={(e) => updateContent({ items: s.content.items.map((x) => x.id === it.id ? { ...x, label_en: e.target.value } : x) })} />
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent({ items: [...s.content.items, { id: nid("st"), value: "0", label_ar: "", label_en: "" } as StatItem] })}>
            <Plus className="h-3 w-3 me-1" /> إضافة
          </Button>
        </div>
      )}

      {s.type === "gallery" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
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
                    onClick={() => updateContent({ images: s.content.images.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <MediaUploader value={im.url ?? null} onChange={(url) => updateContent({ images: s.content.images.map((x, j) => j === i ? { ...x, url: url ?? undefined } : x) })} bucket="content-media" kind="image" folder="cms/gallery" />
                <Input placeholder="Alt" value={im.alt ?? ""} onChange={(e) => updateContent({ images: s.content.images.map((x, j) => j === i ? { ...x, alt: e.target.value } : x) })} />
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={() => updateContent({ images: [...s.content.images, {}] })}><Plus className="h-3 w-3 me-1" /> إضافة صورة</Button>
          </div>
        </>
      )}

      {s.type === "cta" && (
        <>
          <TextField label="العنوان (ع)" value={s.content.title_ar} onChange={(v) => updateContent({ title_ar: v })} />
          <TextField label="Title (EN)" value={s.content.title_en} onChange={(v) => updateContent({ title_en: v })} />
          <TextField label="الوصف (ع)" multiline value={s.content.subtitle_ar} onChange={(v) => updateContent({ subtitle_ar: v })} />
          <TextField label="Subtitle (EN)" multiline value={s.content.subtitle_en} onChange={(v) => updateContent({ subtitle_en: v })} />
          <ButtonsEditor buttons={s.content.buttons} onChange={(b) => updateContent({ buttons: b })} />
        </>
      )}

      {s.type === "legacy_home" && (
        <p className="text-xs text-muted-foreground">هذا قسم نظام يعرض الصفحة الرئيسية الحالية بتصميمها الكامل. لا توجد إعدادات قابلة للتعديل.</p>
      )}

      <div className="pt-3 border-t border-border">
        <h4 className="font-medium mb-2 text-xs">المسافات والخلفية</h4>
        <SpacingFields s={s} onChange={onChange} />
      </div>

      <div className="pt-3 border-t border-border">
        <VisibilityFields s={s} onChange={onChange} />
      </div>
    </div>
  );
}
