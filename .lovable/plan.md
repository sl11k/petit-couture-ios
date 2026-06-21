
## الهدف
إصلاح 4 مشاكل أساسية أبلغت بها، بالترتيب التالي.

---

### 1) إيقاف وميض الصفحة القديمة قبل الجديدة
**السبب**: `Index` و `product.$slug` و `category.$slug` يعرضون التصميم القديم فوراً ثم يبدّلونه لما تنتهي `useEffect` من جلب `cms_pages.published_content`. هذا يخلق الوميض.

**الحل**:
- نقل جلب `cms_pages` من `useEffect` إلى `loader` في الراوت (مع `queryClient.ensureQueryData`) حتى يكون المحتوى جاهز قبل الرندر الأول.
- إضافة `pendingComponent` يعرض skeleton مطابق للتخطيط بدلاً من التصميم القديم.
- في الصفحات اللي ما عندها CMS override، نتخطى الجلب كلياً.

---

### 2) صور المنتج (تظهر صورة واحدة فقط)
**السبب المحتمل**: عمود `images` في DB قد يُحفظ كـ string بدل array، أو الـ PDP يقرأ `image_url` فقط بدل `images`.

**الحل**:
- مراجعة `useDbProductBySlug` للتأكد من معالجة `images` (jsonb) صح + fallback لـ `image_url`.
- مراجعة gallery component في `product.$slug.tsx` للتأكد من map صحيح على المصفوفة.
- لو الـ admin يحفظ بصيغة خاطئة، إصلاح `MediaUploader` / `ProductMediaGallery` ليحفظ array دائماً.
- إضافة فحص في `mergeRowOntoBase` يعالج الحالات: array، string JSON، CSV string.

---

### 3) التصنيف حسب العمر داخل صفحة الفئة
**السبب**: فلاتر العمر إما ما تُطبَّق على query DB، أو الـ sizes ما تُقرأ صح من DB.

**الحل**:
- إضافة فلتر عمر واضح في `category.$slug.tsx` (chips أعلى الشبكة: 0-3 أشهر، 3-6، 6-12، 1-2 سنة…).
- استخدام `sortByAge` + فلترة المنتجات بناءً على `sizes` الفعلية.
- لو ما فيه منتجات في عمر معيّن، إخفاء الشريحة بدل عرضها فارغة.

---

### 4) محرر مباشر شامل (المهم)
**الحالي**: المحرر يعدّل نصوص/صور/روابط فقط داخل الـ HomeScreen، لكن:
- ما يلمس الهيدر/الفوتر (الكلام تحت الـ logo، روابط الفوتر…)
- ما يعدّل الألوان أو الخلفيات
- ما يضيف/يحذف/يرتّب عناصر

**الحل** — توسيع `SiteInlineEditor` ليكون محرراً كاملاً:

#### أ) تغطية الهيدر والفوتر
- نقل `<SiteInlineEditor>` ليلف كل التطبيق من `__root.tsx` بدل index فقط، حتى يطال `DesktopHeader` + `MobileNav` + `Footer` + `AnnouncementBar`.
- إضافة `pagePath` ديناميكي حسب الراوت الحالي، مع namespace خاص (`global:header`, `global:footer`) للعناصر المشتركة حتى التعديل ينعكس على كل الصفحات.

#### ب) تعديل الـ style
- Side panel ينفتح عند اختيار عنصر، يعرض:
  - **النص**: حجم الخط، الوزن، لون النص، محاذاة
  - **الخلفية**: لون / صورة / gradient
  - **المسافات**: padding، margin
  - **الحدود**: لون، عرض، radius
- يُحفظ كـ `prop: "style"` في `live_overrides` بـ value = jsonb للستايلات، ويُطبَّق عبر inline style attribute.

#### ج) إضافة/حذف/ترتيب عناصر (block editor)
- لكل قسم في `HomeScreen` و `Footer` نضيف `data-lpe-section="hero"` (مثلاً).
- يظهر toolbar فوق القسم: ↑ تحريك لأعلى، ↓ تحريك لأسفل، × حذف، + إضافة بلوك جديد.
- البلوكات المتاحة للإضافة: نص، صورة، زر، شبكة منتجات، بانر، فاصل.
- يُحفظ في جدول جديد `page_blocks` (page_path, position, type, props, status).

#### د) Color picker للهوية
- زر "ألوان الموقع" في toolbar يفتح dialog يعدّل CSS variables الأساسية (`--primary`, `--background`…) ويحفظها في `site_settings`، تنعكس فوراً على كل الموقع.

---

## التفاصيل التقنية

### ملفات جديدة
- `src/live-edit/StyleEditor.tsx` — لوحة جانبية لتعديل style العنصر
- `src/live-edit/BlockToolbar.tsx` — أزرار ↑↓×+ فوق الأقسام
- `src/live-edit/AddBlockDialog.tsx` — اختيار نوع البلوك الجديد
- `src/live-edit/ColorThemeEditor.tsx` — محرر ألوان الموقع
- `src/live-edit/blocks/` — مكوّنات البلوكات (Text, Image, Button, ProductGrid, Banner)

### تعديلات
- `src/routes/__root.tsx` — لفّ كل شيء بـ `SiteInlineEditor` مع `pagePath` ديناميكي
- `src/routes/index.tsx` + `product.$slug.tsx` + `category.$slug.tsx` — نقل الـ fetch إلى loader + pending skeleton
- `src/hooks/useDbProducts.ts` — معالجة `images` لكل الصيغ
- `src/components/Footer.tsx` + `DesktopHeader.tsx` — إضافة `data-lpe-section` markers
- `src/components/HomeScreen.tsx` — تقسيم لأقسام قابلة للحذف/الإضافة

### جدول جديد
```sql
create table public.page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  section_key text not null,
  position int not null default 0,
  block_type text not null,
  props jsonb not null default '{}',
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
مع RLS: قراءة عامة للـ published، كتابة للأدمن فقط.

---

## الحجم
هذا شغل ضخم — حوالي 15-20 ملف جديد/معدّل + migration. سأنفّذه على دفعتين:

**الدفعة 1 (هذه الجلسة)**: إصلاح الوميض + صور المنتج + فلتر العمر + توسيع المحرر ليغطي الهيدر/الفوتر مع تعديل style أساسي (لون، خلفية، حجم خط).

**الدفعة 2 (بعد ما تأكد على الأولى)**: block editor كامل (إضافة/حذف/ترتيب) + color theme editor.

موافق نبدأ بالدفعة 1؟
