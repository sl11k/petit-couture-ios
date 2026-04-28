# متطلبات الأداء — Performance Requirements

> هذه ميزانية أداء واضحة وقابلة للقياس. كل رقم تجده هنا يُراقَب فعليًا
> من خلال جمع Web Vitals من المستخدمين الحقيقيين وتسجيله في جدول `perf_metrics`،
> وتُعرض النتائج في صفحة `/admin/performance`.

## 1. Core Web Vitals (مستهدفات p75)

| المقياس | الميزانية | حدّ التحذير | السبب |
| --- | --- | --- | --- |
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | > 4.0s | سرعة ظهور المحتوى الأساسي |
| **INP** (Interaction to Next Paint) | ≤ 200ms | > 500ms | استجابة الواجهة للنقرات |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | > 0.25 | استقرار التصميم |
| **TTFB** (Time to First Byte) | ≤ 800ms | > 1.8s | سرعة الخادم |
| **FCP** (First Contentful Paint) | ≤ 1.8s | > 3.0s | أول رسم |

## 2. ميزانيات خاصة بالموقع

| المسار/العملية | الهدف |
| --- | --- |
| تنقّل بين الصفحات (Route change) | ≤ 500ms |
| تحميل صفحة المنتج | ≤ 2.0s |
| كل خطوة في Checkout | ≤ 1.5s |
| Autocomplete أثناء البحث | ≤ 250ms |
| تحميل جدول إداري (50 صف) | ≤ 1.5s |
| استجابة API (p95) | ≤ 800ms |
| حجم JS الأولي للصفحة الرئيسية | ≤ 200KB gzip |
| حجم الصورة الواحدة | ≤ 200KB (WebP/AVIF عند الإمكان) |

## 3. كيف نحقّق هذه الأرقام

### تحميل سريع للصفحات
- **TanStack Router code-splitting تلقائي**: كل صفحة في chunk منفصل، يُحمَّل عند الحاجة.
- **Loaders SWR caching**: نتائج الراوت تُخزَّن مؤقتًا (`staleTime`) وتُحدَّث في الخلفية.
- **SSR + hydration**: الصفحات تُولَّد على الخادم وتُسَلَّم بـ HTML جاهز.

### تحسين الصور + Lazy Loading
- مكوّن `<LazyImage>` (`src/components/LazyImage.tsx`) يُجبر `loading="lazy"`،
  `decoding="async"`، و `fetch-priority` صحيح.
- `aspect-ratio` لحجز المساحة → **CLS = 0** على الصور.
- صور المنتجات في الشبكة تستخدم `loading="lazy"` (موجود فعلًا في `search.tsx`).
- صورة Hero واحدة فقط لكل صفحة تُحمَّل بـ `eager`.

### Caching
- **TanStack Router SWR**: `staleTime` على الراوتات الثابتة (الأقسام/الإعدادات).
- **HTTP caching**: استجابات Lovable Cloud Edge تستفيد من cache headers.
- **Service-side**: نتائج autocomplete مفهرسة GIN/Trigram → استعلامات بـ ms.

### CDN
- النشر على Lovable يضع كل الأصول الثابتة (JS, CSS, fonts) خلف **Cloudflare CDN عالميًا**.
- صور المنتجات عبر Supabase Storage → CDN تلقائي.

### تقليل JavaScript غير الضروري
- `autoCodeSplitting` مفعَّل (افتراضي في TanStack Start).
- لا نُصدِّر دوال المكوّنات من ملفات الراوت (يمنع التقسيم).
- مكتبات ثقيلة يجب أن تُستورد ديناميكيًا داخل دوال الأحداث، لا في module-scope.

### صفحات منتجات سريعة
- استعلام منتج واحد بفهرس على `slug` → < 50ms.
- صور بـ `<LazyImage>` + `decoding=async`.
- مراجعات وتوصيات مؤجَّلة عبر `Suspense` + `Await` (deferred loader data).

### Checkout سريع
- تقليل الحقول وإظهار Apple Pay مبكرًا (نُفِّذ في `ConversionWidgets`).
- لا يوجد Round-trip بين الخطوات — كل خطوة تتم محليًا قبل الإرسال النهائي.
- استدعاء API الدفع يحدث مرة واحدة عند الإرسال.

### لوحة إدارة لا تتجمّد على آلاف الطلبات
- **كل جدول إداري يستخدم pagination على الخادم** (50 صف لكل صفحة في
  `admin.orders`, `admin.products`، إلخ) — ليس تحميل الكل ثم ترشيح في الذاكرة.
- فهارس مخصّصة على الأعمدة الحساسة:
  - `orders(status, created_at desc)`, `orders(payment_status, created_at desc)`
  - `orders(customer_email)`, `orders(customer_phone)`
  - `audit_logs(action, created_at desc)`
  - `search_logs(created_at desc)`
- Audit logs محدودة بـ 200 سجل افتراضيًا مع فلاتر تاريخ/إجراء.
- جداول طويلة لا تستخدم `key` غير مستقر ولا re-render كامل.

### Pagination / Infinite Scroll
- نمط Pagination الحالي: `range(from, to)` + `count: "exact"` لإظهار الإجمالي.
- يُمكن تحويل أي جدول إلى Infinite Scroll بإضافة IntersectionObserver
  واستخدام نفس API الترقيم.

### بحث وفلاتر سريعة
- `tsvector` index + GIN على المنتجات → بحث نصي فوري.
- `pg_trgm` index على الأسماء/العلامات → تحمّل الأخطاء الإملائية بدون JS ثقيل.
- RPC `search_autocomplete` يُرجع نتائج مرتّبة حسب الصلة في < 50ms.
- فلترة الفئة/العلامة/السعر تستخدم فهارس B-tree موجودة.

### تحمّل عدد كبير من المستخدمين
- Lovable Cloud: قاعدة بيانات Postgres مُدارة + CDN عالمي.
- لكل عملية كتابة حساسة: RLS + idempotency key (موجود على الطلبات).
- عند الحمل العالي → ترقية حجم الـ instance من **Backend → Advanced settings → Upgrade instance**.

### مراقبة الأداء
- `src/lib/perf.ts` يجمع Web Vitals من كل مستخدم حقيقي ويرسلها في batches.
- جدول `perf_metrics` + RLS (الإدراج للجميع، القراءة للإدارة فقط).
- صفحة `/admin/performance` تعرض:
  - p75 لكل مقياس مع مقارنته بالميزانية
  - أبطأ 10 صفحات حسب LCP
  - عدّ Long Tasks (مؤشّر تجمّد UI)
  - تقسيم Mobile/Desktop

## 4. بوّابات الجودة (Quality Gates)

قبل أي إطلاق:
- [ ] LCP p75 ≤ 2.5s على الموبايل (4G)
- [ ] لا توجد long tasks > 200ms في تدفق Checkout
- [ ] حجم JS الأولي للصفحة الرئيسية ≤ 200KB gzip
- [ ] جميع الجداول الإدارية مُرقَّمة على الخادم (لا `select * limit 10000`)
- [ ] جميع `<img>` خارج الـ hero تستخدم `loading="lazy"`
- [ ] الفهارس المذكورة أعلاه موجودة في قاعدة البيانات

## 5. مراجع التنفيذ

| الملف | الدور |
| --- | --- |
| `src/lib/perf.ts` | تعريف الميزانيات + جمع Web Vitals |
| `src/components/LazyImage.tsx` | صورة كسولة بدون CLS |
| `src/routes/__root.tsx` | تشغيل `startWebVitals()` |
| `src/routes/admin.performance.tsx` | لوحة المراقبة |
| Migration: `perf_metrics` + indexes | فهرسة هوت-كويريز |
