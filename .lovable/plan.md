
# Visual Page Builder / Pages CMS — خطة البناء

نظام كامل متعدد الصفحات (Pages CMS) مع محرر بصري شبيه بـ Webflow/Framer مصغّر داخل لوحة الأدمن. هذا مشروع ضخم لا يمكن إنجازه في رسالة واحدة. سأبنيه على 5 مراحل، كل مرحلة قابلة للاستخدام بحد ذاتها، وننتقل للمرحلة التالية بعد موافقتك.

## ملاحظة مهمة قبل البداية

المشروع الحالي يحتوي أصلاً على نظام إدارة محتوى جزئي للصفحة الرئيسية عبر جداول: `home_sections`, `featured_categories`, `popular_picks`, `storefront_banners`, `announcement_messages`, `content_pages`. الـ Builder الجديد **لن يحذف هذي الجداول** — سيضيف طبقة `pages` + `page_versions` فوقها، وعند عرض الصفحة الرئيسية: إذا فيه `published_content` نعرضه، وإلا نرجع للسلوك الحالي (fallback) عشان ما نكسر شي.

---

## المرحلة 1 — البنية التحتية (Schema + DB + Public Renderer)

**الهدف:** قاعدة البيانات + عرض الصفحات المنشورة على الموقع (بدون editor بعد).

### Migration
- جدول `cms_pages`: `id, slug (unique), title_ar, title_en, type (home|about|contact|custom), status (draft|published), draft_content jsonb, published_content jsonb, seo_title_ar/en, seo_description_ar/en, og_image_url, noindex bool, canonical_url, created_by, created_at, updated_at, published_at`
- جدول `cms_page_versions`: `id, page_id fk, content jsonb, version_label, created_by, created_at`
- RLS: قراءة عامة للـ `published_content` فقط (anon)، كتابة/قراءة كاملة للأدوار `super_admin/admin/content_manager`
- GRANT statements لكل جدول
- Trigger `updated_at`

### كود
- `src/page-builder/schemas/pageSchema.ts` — TypeScript types: `PageContent`, `Section` (union مع `HeroSection | TextBlock | FeatureGrid | Testimonials | FAQ | CTA | Gallery | ImageText | Stats | RawHomeLegacy`), `Settings`, `ResponsiveSettings`
- `src/page-builder/components/sections/*.tsx` — مكوّن render لكل نوع section (8-10 ملفات)
- `src/page-builder/components/PageRenderer.tsx` — يستقبل `PageContent` ويعرض الـ sections
- تعديل `src/routes/index.tsx`: يقرأ `cms_pages` where `slug='home' and status='published'`. إذا موجود → `<PageRenderer/>`. إذا لا → `<HomeScreen/>` الحالي (fallback).
- Seed migration: إنشاء صفحة `home` بمحتوى افتراضي يستخدم section نوع `legacy_home` يعرض `HomeScreen` كما هو (عشان لا يتغير شي بصرياً قبل أن يبدأ التعديل).

---

## المرحلة 2 — Pages List + Page Settings + Save/Publish

**الهدف:** أدمن يقدر يفتح قائمة الصفحات، يعدّل بيانات الصفحة (title, slug, SEO)، حفظ + نشر.

- `src/routes/admin.cms-pages.index.tsx` — جدول الصفحات: عنوان، slug، حالة، آخر تعديل، أزرار (تعديل، معاينة، نسخ، حذف، إصدارات).
- `src/routes/admin.cms-pages.$id.tsx` — shell للمحرر (يحتوي top bar + sidebars فارغة + canvas يعرض PageRenderer للـ draft).
- `src/page-builder/components/PageSettingsPanel.tsx` — title, slug, SEO, og_image, noindex.
- `src/page-builder/hooks/usePageEditor.ts` — يحمّل `draft_content`، يحتفظ بـ in-memory state، يوفّر `save()` و `publish()` و undo/redo (history stack).
- زر Save Draft → يحدّث `draft_content`. Publish → ينسخ `draft_content` إلى `published_content`، يكتب row في `cms_page_versions`.
- Sidebar item جديد "Page Builder".
- حماية: لازم `canAccessAdmin` + permission `cms.edit`.

---

## المرحلة 3 — Section Library + Drag & Drop

**الهدف:** إضافة sections، إعادة ترتيبها، حذفها.

- `src/page-builder/components/SectionLibrary.tsx` — قائمة أنواع الأقسام مع أيقونات. ضغط → إضافة section بمحتوى افتراضي.
- `src/page-builder/utils/pageDefaults.ts` — default content لكل نوع.
- `src/page-builder/components/SortableSection.tsx` — wrapper drag handle (using `@dnd-kit/sortable`).
- زر "حذف" / "تكرار" / "إخفاء" على كل section في الـ canvas.
- تثبيت dependency: `@dnd-kit/core @dnd-kit/sortable`.

---

## المرحلة 4 — Click-to-Edit + Right Sidebar (التعديل البصري)

**الهدف:** ضغط على عنصر داخل الـ canvas → يفتح في الـ right sidebar حقول تعديله.

- في كل section component داخل `PageRenderer`، يكون فيه `editing` context. كل عنصر قابل للتعديل يلتف بـ `<Editable id="title">`.
- `EditorCanvas` يحقن iframe-like context: hover outline + click selection.
- `src/page-builder/components/EditorSidebar.tsx` — يعرض حقول الـ section المحدّد حسب نوعه (schema-driven: نعرّف لكل نوع section قائمة حقوله).
- حقول: نص، صورة (يستخدم `MediaUploader` الموجود)، زر (label/url/variant)، لون، spacing، alignment، visibility.
- Live update فوري: تعديل الحقل → state يتحدّث → canvas يعيد render.
- `DevicePreviewToggle`: desktop/tablet/mobile (يغيّر max-width على الـ canvas).
- تحذير "تغييرات غير محفوظة" عند مغادرة الصفحة.

---

## المرحلة 5 — Version History + تفكيك HomeScreen + Polish

**الهدف:** ميزات نهائية + تحويل الصفحة الرئيسية الحالية لـ schema حقيقي.

- `VersionHistoryModal.tsx`: قائمة الإصدارات، معاينة، استعادة.
- تفكيك `HomeScreen` الحالي:
  - Hero (banners) → section `hero`
  - Announcements → section `announcement_bar`
  - Featured categories → section `featured_categories` (يبقى يقرأ من `featured_categories` table)
  - Popular picks → section `popular_picks`
  - Home sections → section `product_grid`
  - يعني الـ Builder يدير **ترتيب وإظهار** الأقسام، والبيانات تبقى تأتي من جداولها الحالية (hybrid). هذا يحافظ على عمل لوحات الأدمن الحالية لإدارة المنتجات/الفئات.
- Polish: validation (slug unique, title required)، unsaved warning، keyboard shortcuts (Cmd+S, Cmd+Z)، loading states.

---

## القيود والمقايضات

- **لن أبني Live editing بشكل iframe معزول حقيقي** — التعديل يتم في نفس React tree مع طبقة overlay للـ selection. هذا أبسط وأسرع ولا فرق وظيفي.
- **Inline text editing داخل الـ canvas** سيكون contentEditable بسيط (مرحلة 4)، التعديل الأساسي عبر الـ right sidebar.
- **Drag بين الـ section library والـ canvas** سيكون click-to-add أولاً، drag-from-library لاحقاً إذا طلبت.
- **Per-device responsive overrides** سيشمل: padding، إخفاء section، text alignment. لن يشمل overrides كاملة لكل حقل (تعقيد كبير جداً).

---

## الخطوة التالية

أبدأ **المرحلة 1** الآن (DB migration + PageRenderer + integration مع `/`). بعد ما توافق على المرحلة 1 وتشتغل، ننتقل للمرحلة 2.

هل أبدأ بالمرحلة 1؟
