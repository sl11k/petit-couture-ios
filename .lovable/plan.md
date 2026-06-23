## المشكلة

**1. مشكلة اللغة:** التحرير المباشر (Live Edit) يحفظ التعديلات مربوطة باللغة الحالية (مثلاً `lang=ar`). لمّا تبدّلين الموقع للإنجليزي، التعديلات النصية وتغييرات الأنماط (لون/خط/حجم) ما تنطبق، فيرجع الشكل القديم. السبب في `src/live-edit/useApplyOverrides.ts` السطر 35: التعديلات مفلترة باللغة، وفي `overrides.ts` الـ style overrides تتخزّن أيضاً مربوطة بلغة معينة.

**2. تحكم النص:** حالياً الـ Live Edit عنده popover بسيط (`StylePopover.tsx`) لكن خياراته محدودة. مكتوب فيه فقط تعديل بعض الأنماط الأساسية، ما فيه لوحة شاملة لكل خصائص النص.

## الخطة

### الجزء الأول: إصلاح مشكلة اللغة
- في `overrides.ts`: تعديل `effectiveLanguage` بحيث **تعديلات الأنماط (style) تُحفظ دائماً بـ `lang="*"`** (مشتركة بين اللغتين)، لأن اللون/الخط/الحجم/الموضع ما يتغيّر بتغيّر اللغة. فقط النص (`text`/`html`) يبقى مربوط باللغة.
- في `useApplyOverrides.ts`: تطبيق style overrides على كل اللغات بدون فلترة (موجود جزئياً بس نتأكد منه).
- في `persistDraft`: لمّا يحفظ تعديل style، يحوّل `lang` تلقائياً لـ `*`.
- ترحيل بياناتي (migration) يحدّث أي صف موجود في `live_overrides` نوعه `style` ويخلّي `lang='*'`، مع حذف التكرارات.

### الجزء الثاني: لوحة تحكم نصوص شاملة في Live Edit
توسيع `src/live-edit/StylePopover.tsx` بحيث لمّا تختاري أي نص في الصفحة تطلع لكِ لوحة فيها:

| الخاصية | الخيارات |
|---|---|
| نوع الخط (Font Family) | قائمة (Inter, Cairo, Tajawal, Almarai, Playfair, إلخ) |
| حجم الخط | slider من 10px إلى 96px |
| الوزن (Weight) | 300/400/500/600/700/800/900 |
| لون النص | color picker |
| لون الخلفية | color picker + شفّاف |
| المحاذاة | يمين / وسط / يسار |
| تباعد الأسطر (line-height) | slider |
| تباعد الأحرف (letter-spacing) | slider |
| تحويل النص (uppercase/lowercase) | toggle |
| تزيين النص (underline/strike) | toggle |
| الهوامش الداخلية والخارجية (padding/margin) | 4 حقول لكل جهة |
| المحاذاة الأفقية (موضع العنصر) | flex/center/start/end |
| الظل (text-shadow) | preset |

كل التعديلات تنحفظ كـ `style` overrides في `live_overrides` مع `lang='*'` فتنطبق على اللغتين.

### تفاصيل تقنية
- ملفات تعديل: `src/live-edit/overrides.ts`, `src/live-edit/useApplyOverrides.ts`, `src/live-edit/StylePopover.tsx`, `src/live-edit/SiteInlineEditor.tsx` (للتأكد إن الـ popover يفتح على أي نص).
- Migration واحدة لتنظيف صفوف `style` القديمة المربوطة بلغة معينة.
- ما رح ألمس Page Builder حالياً (المستخدم اختار Live Edit فقط).