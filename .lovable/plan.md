# خطة نظام المستودعات + متغيرات المنتج (variants) + المخزون

سأنفذ هذا على **3 مراحل** كما اخترت. هذا الرد يصف الخطة الكاملة، ثم سأبدأ تنفيذ **المرحلة 1** فقط بعد موافقتك. عند انتهاء كل مرحلة سأعرض ملخصاً وننتقل للتالية.

---

## مبادئ عامة (تطبق على كل المراحل)
- لا حذف لأي ميزة قائمة. `products.stock` يبقى موجوداً ويُحدَّث تلقائياً من مجموع `inventory.quantity` عبر trigger (مصدر الحقيقة = جدول `inventory`).
- كل البيانات في DB (لا hardcoded).
- RLS مفعّل على الجداول الجديدة: قراءة عامة للمخزون المتاح فقط، كتابة للأدمن/super_admin.
- العربي/الإنجليزي وRTL محفوظ.

---

## المرحلة 1 — مستودعات + جدول inventory + ترحيل تلقائي (سأبدأ بها الآن)

### قاعدة البيانات
- جدول `warehouses` (id, name, name_en, code, country_code, region, city, address, latitude, longitude, status, priority, created_at, updated_at).
  - `country_code` و `latitude/longitude` يخدمان قرار "أقرب مستودع" في المرحلة 3.
- جدول `inventory` (id, product_id, variant_id NULL في المرحلة 1, warehouse_id, sku, quantity, reserved_quantity, low_stock_threshold, status, created_at, updated_at).
  - UNIQUE (product_id, variant_id, warehouse_id).
- Trigger `inventory_sync_product_stock`: عند أي INSERT/UPDATE/DELETE على `inventory` يُحدِّث `products.stock = SUM(quantity - reserved_quantity)` للمنتج.
- Migration ترحيلي: ينشئ مستودعاً افتراضياً `Main Warehouse` (code=MAIN, country=SA, status=active) ويُدرج سجل inventory واحد لكل منتج موجود بالقيمة الحالية لـ `products.stock`.
- دوال SECURITY DEFINER:
  - `get_warehouse_stats()` لإحصائيات صفحة المستودعات (عدد المنتجات، إجمالي المخزون، تحذيرات low stock).
  - `adjust_inventory(_inventory_id, _delta, _reason)` لتعديلات آمنة مع audit.

### الأدمن (UI)
- صفحة جديدة `/admin/warehouses` بنفس نمط `AdminPage` الحالي:
  - جدول: الاسم، الكود، الدولة/المدينة، الحالة، عدد المنتجات، إجمالي المخزون، تحذيرات low stock.
  - فلاتر: نشط/غير نشط/low stock + بحث.
  - أزرار create/edit/delete (delete = soft-disable إذا كان فيه inventory).
- إضافة الرابط للقائمة الجانبية ضمن قسم "العمليات".
- تحديث صفحة المنتج في الأدمن: عرض جدول inventory للقراءة فقط في المرحلة 1 (التعديل الكامل في المرحلة 2).

### الواجهة (Storefront)
- لا تغيير ظاهر. `products.stock` يظل محسوباً تلقائياً، فكل ما يعتمد عليه (PDP، السلة، checkout) يستمر بالعمل كما هو.

---

## المرحلة 2 — متغيرات المنتج (variants) + ربط بالـ PDP/السلة

### قاعدة البيانات
- جدول `product_option_types` (للمنتج: Size, Color, …)
- جدول `product_option_values` (S, M, L, Red, …)
- جدول `product_variants` (id, product_id, sku, price_override NULL, image_url, status, attributes jsonb)
- جدول جسر `variant_option_values`
- تحديث `inventory`: `variant_id` يصبح NOT NULL لأي منتج مفعَّل عليه variants. منتج بدون variants → سجل واحد per warehouse مع variant_id NULL (backward compatible).
- تحديث `cart_items` (إن وُجد جدول مستمر) و `order_items` لإضافة `variant_id` و `warehouse_id` (nullable للطلبات القديمة).

### الأدمن
- في صفحة تعديل المنتج: تبويب جديد "المتغيرات والمخزون" يتيح تفعيل variants وإدارة المقاسات/الألوان، ولكل تركيبة تعيين stock في كل warehouse + SKU خاص.
- جدول inventory الموصوف في طلبك: Size | Warehouse | SKU | Qty | Status | Actions.

### الواجهة
- صفحة المنتج: محدد المقاس (مع تعطيل المقاسات النافدة عبر كل المستودعات).
- السلة: تخزن `variant_id`.
- مستودع الخصم لا يُحدَّد في السلة — يُختار وقت checkout (مرحلة 3).
- منتج بدون variants يبقى يعمل كما هو.

---

## المرحلة 3 — Checkout + اختيار المستودع الأقرب + Fulfillment

### Routing المستودع (حسب اختيارك: الأقرب جغرافياً)
1. عند checkout نأخذ عنوان الشحن (country, city, [lat/lng إن وُجد]).
2. خوارزمية الاختيار لكل سطر:
   - فلتر: مستودعات `status=active` بها `quantity - reserved_quantity >= qty المطلوبة` للـ variant.
   - أولوية أولى: نفس `country_code`.
   - أولوية ثانية: نفس `region` أو `city`.
   - الترتيب النهائي: مسافة haversine بين إحداثيات العنوان والمستودع (نتطلب lat/lng على المستودع لتفعيل المسافة؛ إن لم تتوفر، نقع على `priority` ثم created_at).
3. الـ checkout يحجز المخزون (`reserved_quantity += qty`) داخل transaction قبل إنشاء الطلب، ويحرره عند الفشل/الانتهاء/الإلغاء (مثل آلية `release_expired_order_stock` الموجودة).
4. عند نجاح الدفع، الترحيل من reserved إلى خصم نهائي عبر تحديث `finalize_order_stock`.

### الأدمن
- صفحة الطلب: لكل order_item نعرض المستودع المُنفِّذ + تاريخ الخصم. زر "تغيير المستودع" يدوياً للأدمن.
- صفحة inventory low-stock alerts متصلة بـ admin_notifications.

### الواجهة
- رسائل واضحة: "هذا المقاس غير متوفر"، "تم تحديث المخزون قبل إتمام الطلب، يرجى المراجعة".

---

## ملاحظات تقنية مهمة
- كل migrations تُكتب بحيث لا تكسر البيانات الحالية (NULL-safe، defaults، ON CONFLICT DO NOTHING).
- لن أُنشئ أي بيانات وهمية. مستودع "Main Warehouse" هو بيانات تشغيلية ضرورية للترحيل وليس fake data.
- ملفات server-fn جديدة تحت `src/lib/warehouses.functions.ts` و `src/lib/inventory.functions.ts` للعمليات التي تحتاج صلاحيات admin.

---

**هل أبدأ المرحلة 1 الآن؟** بعد الموافقة سأنفذ migrations + صفحة `/admin/warehouses` + ربط القائمة الجانبية، ثم أعرض ملخصاً قبل البدء بالمرحلة 2.