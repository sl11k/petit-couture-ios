# محرر مباشر على الصفحة (Live Inline Editor)

## الهدف
لما تكون مسجل دخول كمشرف، تضغط زر "تحرير الصفحة" فيتحول الموقع لوضع تحرير: تنقر على أي نص/صورة/زر/قسم وتعدله مباشرة وتشوف النتيجة فوراً، وفي الأخير تضغط "حفظ" أو "نشر".

## نطاق هذه المرحلة
- **الصفحة الرئيسية** (مبنية أصلاً على `cms_pages` + `PageRenderer`).
- **الهيدر والفوتر** (شريط الإعلانات، روابط القائمة، شعار، روابط الفوتر، السوشيال).
- **الصفحات الثابتة** (`/page/$slug` — نفس المحرك يشتغل عليها).
- **صفحة التصنيف وصفحة المنتج**: تحرير العناوين/الأوصاف وأزرار الـ CTA فقط في هذه المرحلة (الباقي يحرَّر من لوحة المنتجات/التصنيفات).

## ما يمكن تحريره مباشرة
1. **النصوص** — `contentEditable` على أي عنوان/فقرة/زر/رابط (عربي + إنجليزي عبر تبديل اللغة).
2. **الألوان والخطوط** — لوحة جانبية تظهر للعنصر المحدد: لون الخلفية، لون النص، حجم الخط، الوزن، نصف القطر، الحشو.
3. **الصور** — نقر على أي صورة → اختر من المعرض/ارفع جديدة/الصق رابط.
4. **الروابط** — `LinkPicker` الموجود (صفحات/تصنيفات/منتجات/خارجي).
5. **الترتيب والإخفاء** — مقابض سحب/إفلات على الأقسام + زر إخفاء/إظهار + حذف.

## طريقة العمل (UX)
- زر عائم "تحرير الصفحة ✏️" يظهر للمشرف فقط (موجود `EditPageButton`).
- بالضغط: تدخل وضع التحرير، الصفحة نفسها تصير قابلة للتحرير (لا ينقلك لصفحة أخرى).
- شريط علوي عائم فيه: تراجع/إعادة، حفظ مسودة، نشر، خروج، تبديل ar/en، عرض موبايل/سطح.
- لوحة جانبية يمنى تظهر عند اختيار عنصر (نص/قسم/صورة) فيها التحكمات.
- كل تغيير ينعكس فوراً في الـ DOM (state محلي)، ولا يُحفظ في قاعدة البيانات إلا بزر "حفظ".

## التنفيذ التقني
- **EditModeContext** جديد: `{ enabled, selection, draft, setField, undo, redo, save, publish }`.
- **`<Editable />`** wrapper يلف أي نص: في وضع التحرير يصير `contentEditable` ويبث التغييرات لـ context. في الوضع العادي يرندر نص عادي.
- **`<EditableImage />`** و **`<EditableSection />`** و **`<EditableStyle />`** — نفس الفكرة.
- **`LiveEditOverlay`** — يحتوي شريط الأدوات + اللوحة الجانبية + ربط Drag-and-Drop للأقسام.
- المسودة كاملة تُحفظ في `cms_pages.draft_content` (الرئيسية + ثابتة) و`site_settings`/`storefront_settings` (الهيدر/الفوتر/الإعلانات).
- النشر يكتب `published_content` ويُحدث الإصدار في `cms_page_versions` / `site_revisions`.

## ملفات ستُنشأ/تُعدَّل (ملخص)
- جديدة:
  - `src/live-edit/EditModeContext.tsx`
  - `src/live-edit/components/LiveEditOverlay.tsx`
  - `src/live-edit/components/EditToolbar.tsx`
  - `src/live-edit/components/InspectorPanel.tsx`
  - `src/live-edit/components/Editable.tsx`
  - `src/live-edit/components/EditableImage.tsx`
  - `src/live-edit/components/EditableSection.tsx`
  - `src/live-edit/hooks/useLiveDraft.ts`
  - `src/live-edit/persistence.ts` (حفظ/نشر/إصدارات)
- مُعدَّلة:
  - `src/routes/__root.tsx` — تركيب `EditModeProvider` و`LiveEditOverlay`.
  - `src/components/EditPageButton.tsx` — يُفعّل وضع التحرير بدل ما يفتح لوحة الأدمن.
  - `src/page-builder/components/PageRenderer.tsx` — يلف الأقسام بـ `EditableSection` ويستخدم `Editable` للنصوص.
  - `src/components/DesktopHeader.tsx` و`src/components/Footer.tsx` و`src/components/AnnouncementBar.tsx` — تلف عناصرها القابلة للتحرير.
  - `src/components/HomeScreen.tsx` — يربط كل نص بمصدره من القاعدة عبر `Editable`.

## خارج النطاق (مراحل قادمة)
- تحرير منتجات/تصنيفات داخل البطاقة (يبقى في لوحة الأدمن).
- محرر CSS متقدم/كود مخصص.
- إصدارات A/B للصفحات داخل المحرر المباشر.

ابدأ التنفيذ؟
