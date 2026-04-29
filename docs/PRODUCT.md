# Product Document — Maisonnét

وثيقة المنتج الشاملة. تجمع البريف، الـ Personas، الـ Sitemap، Flows، Wireframes، تفاصيل الشاشات، MVP/V2 وBacklog.

> هذه الوثيقة تربط بالوثائق التفصيلية: [`SECURITY.md`](./SECURITY.md) · [`PERFORMANCE.md`](./PERFORMANCE.md) · [`SEO.md`](./SEO.md) · [`API.md`](./API.md) · [`ERRORS.md`](./ERRORS.md) · [`STATES.md`](./STATES.md) · [`MOBILE.md`](./MOBILE.md) · [`DATA_MODEL.md`](./DATA_MODEL.md) · [`TEST_PLAN.md`](./TEST_PLAN.md) · [`OPERATIONS.md`](./OPERATIONS.md).

---

## 1. Product Brief

**الاسم:** Maisonnét — متجر إلكتروني فاخر للسلع المنزلية والهدايا.

**الرؤية:** تجربة تسوّق أنيقة وسلسة بمعايير عالمية للسوق السعودي/الخليجي، مع دعم كامل للعربية والتشغيل المستقل.

**المشكلة:** المتاجر العربية الحالية تعاني من ضعف التجربة (بطء، دفع غير موثوق، شحن متأخر، خدمة عملاء ضعيفة، عدم احترام RTL).

**الحل:** متجر Mobile-first يجمع:
- كتالوج ذكي مع بحث/تصفية متقدمة.
- Checkout مختصر بـ 3 خطوات + Apple Pay/mada/COD.
- إدارة كاملة (طلبات، مخزون، شحن، CRM، تقارير).
- تكاملات شركات الشحن والدفع السعودية.

**الجمهور:** نساء 25-45 سنة (B2C)، مدن رئيسية (الرياض/جدة/الدمام)، يفضّلن التسوّق عبر الجوال.

**KPIs (السنة الأولى):**
| المؤشر | الهدف |
|---|---|
| معدل التحويل | ≥ 2.5% |
| AOV | ≥ 350 ريال |
| معدل العودة (90 يوم) | ≥ 25% |
| LCP p75 | < 2.5s |
| CSAT الدعم | ≥ 4.5/5 |
| Cart abandonment | ≤ 65% |

**القيود:** ميزانية محدودة، فريق صغير (4-6 أشخاص)، إطلاق MVP خلال 8 أسابيع.

**خارج النطاق (V1):** B2B، marketplace متعدد البائعين، تطبيقات iOS/Android أصلية، الاشتراكات.

---

## 2. User Personas

### 2.1 سارة — العميلة الجديدة (Discovery)
- **العمر:** 28، موظفة في الرياض.
- **الجهاز:** iPhone، تستخدم Instagram.
- **الهدف:** هدية لصديقتها بسرعة وثقة.
- **Pain Points:** خوف من الدفع، عدم وضوح وقت التوصيل، صور غير دقيقة.
- **ما تحتاجه:** مراجعات، صور واقعية، Apple Pay، تتبع لحظي، استرجاع سهل.
- **الرحلة الحرجة:** Instagram → صفحة منتج → checkout سريع.

### 2.2 نورة — العميلة المتكررة (Loyalty)
- **العمر:** 35، أم لطفلين.
- **الهدف:** إعادة الشراء بسرعة، الحصول على عروض خاصة.
- **Pain Points:** إعادة إدخال العنوان، عدم وجود برنامج ولاء.
- **ما تحتاجه:** عناوين محفوظة، wishlist، نقاط ولاء، اقتراحات مبنية على تاريخها.
- **الرحلة الحرجة:** /account/orders → reorder بنقرة.

### 2.3 خالد — موظف خدمة العملاء (Support)
- **الهدف:** الردّ على تذاكر العملاء بسرعة وحلّ المشاكل.
- **Pain Points:** التنقّل بين أنظمة (chat / order / payment)، صعوبة تتبع الشحنة.
- **ما يحتاجه:** صندوق موحَّد، عرض كامل لتاريخ العميل في شاشة واحدة، روابط سريعة لإعادة الإرسال/الاسترجاع.
- **الصلاحيات:** قراءة الطلبات، إرسال رسائل، فتح/إغلاق تذاكر. بدون `customers.view_pii` كاملاً.

### 2.4 منى — مديرة الطلبات (Operations)
- **الهدف:** التأكد من شحن جميع طلبات اليوم.
- **Pain Points:** ضياع الطلبات، أخطاء العنوان، تأخير الشحن.
- **ما تحتاجه:** queue الطلبات، فلاتر سريعة (pending/processing)، طباعة جماعية للملصقات، تنبيهات SLA.
- **الصلاحيات:** تعديل حالة الطلب، إنشاء شحنات، استرداد جزئي. **لا حذف.**

### 2.5 محمد — مدير المتجر (Store Manager)
- **الهدف:** صورة كاملة عن أداء المتجر يومياً + إدارة الفريق.
- **ما يحتاجه:** Dashboard KPIs، إدارة الموظفين والصلاحيات، اعتماد المرتجعات الكبيرة، تقارير.
- **الصلاحيات:** كل شيء عدا secrets/integrations (super_admin فقط).

### 2.6 فهد — موظف المخزون (Inventory)
- **الهدف:** إبقاء المخزون دقيقاً، استلام الشحنات الواردة.
- **Pain Points:** فروقات الجرد، نفاد المنتجات الرائجة بدون تنبيه.
- **ما يحتاجه:** scanner للباركود، حركات مخزون واضحة، تنبيهات `inventory.low`، تقارير الجرد.
- **الصلاحيات:** تعديل `inventory_items` فقط، لا أسعار ولا طلبات.

### 2.7 ريم — مديرة التسويق (Marketing)
- **الهدف:** زيادة المبيعات عبر حملات وكوبونات.
- **ما تحتاجه:** إنشاء كوبونات، صفحات هبوط، حملات إيميل/SMS، تحليل ROI، إدارة السلات المتروكة.
- **الصلاحيات:** Coupons, CMS pages, marketing notifications. لا تعديل أسعار.

### 2.8 عبدالله — المدير المالي (Finance)
- **الهدف:** مطابقة المدفوعات، الفواتير، إعداد التقارير الضريبية (VAT 15%).
- **ما يحتاجه:** تقارير مالية تفصيلية، تصدير CSV/Excel، تتبع المرتجعات والاستردادات، فواتير ZATCA-ready.
- **الصلاحيات:** قراءة فقط على المدفوعات والفواتير + تصدير. لا تعديل.

---

## 3. Sitemap الكامل

```
/  (home)
├── /category/$slug
├── /product/$slug
├── /search?q=
├── /bag                      (السلة)
├── /checkout
│   ├── /checkout/address
│   ├── /checkout/shipping
│   └── /checkout/payment
├── /order/success/$id
├── /order/track/$number      (عام بدون login)
│
├── /auth/login
├── /auth/signup
├── /auth/forgot
├── /auth/reset-password
│
├── /account                  (محمي)
│   ├── /account/orders
│   ├── /account/orders/$id
│   ├── /account/addresses
│   ├── /account/wishlist
│   ├── /account/returns
│   ├── /account/privacy      (الموافقات)
│   └── /account/settings
│
├── /support
│   ├── /support/new
│   └── /support/$ticket_id
│
├── /privacy                  (سياسة الخصوصية)
├── /terms
├── /shipping-info
├── /returns-policy
├── /faq
├── /about
├── /contact
├── /landing/$slug            (صفحات الحملات)
│
├── /unsubscribe?token=
├── /sitemap.xml
├── /robots.txt
│
└── /admin                    (محمي + RBAC)
    ├── /admin/dashboard
    ├── /admin/orders
    │   └── /admin/orders/$id
    ├── /admin/orders/new     (يدوي)
    ├── /admin/products
    │   └── /admin/products/$id
    ├── /admin/inventory
    ├── /admin/categories
    ├── /admin/customers
    │   └── /admin/customers/$id
    ├── /admin/coupons
    ├── /admin/shipments
    ├── /admin/returns
    ├── /admin/refunds
    ├── /admin/cms
    ├── /admin/notifications
    ├── /admin/emails         (dashboard email_send_log)
    ├── /admin/webhooks
    ├── /admin/integrations
    ├── /admin/reports
    ├── /admin/errors
    ├── /admin/states         (dev tool)
    ├── /admin/audit          (super_admin)
    ├── /admin/users          (RBAC)
    ├── /admin/roles
    ├── /admin/privacy
    └── /admin/settings
        └── /admin/settings/theme
```

---

## 4. User Flows

### 4.1 شراء منتج (الدفع الأسرع)
```
Home → Category → Product → "أضف للسلة" → Bag drawer → Checkout
  → Address (محفوظ أو جديد) → Shipping (افتراضي) → Payment (Apple Pay)
  → Success → SMS+Email تأكيد
```
**Happy path:** 5 نقرات للعملاء المسجلين.

### 4.2 إضافة للسلة
```
Product page → اختر variant (لون/مقاس) → اختر qty → "أضف للسلة"
  → Validation (مخزون, variant valid) → Optimistic update
  → Drawer يفتح من اليمين (RTL) → "متابعة التسوّق" أو "Checkout"
```
**Edge cases:** نفاد المخزون، variant غير متاح، ضيف بدون session.

### 4.3 Checkout
```
Bag → /checkout/address
  ├─ مسجّل: قائمة عناوين محفوظة + "+ جديد"
  └─ ضيف: نموذج كامل (اسم/هاتف/مدينة/منطقة/شارع/خريطة)
→ /checkout/shipping (احسب التكلفة بناء على المدينة + الوزن)
→ /checkout/payment
  ├─ Apple Pay (إذا Safari iOS)
  ├─ mada / Visa
  ├─ STC Pay
  └─ COD (إذا متاح في المدينة)
→ Submit → Lock stock → Charge → Success
```

### 4.4 فشل الدفع
```
Payment screen → Submit → 3DS → فشل
  → رسالة عربية محددة (raison code)
  → "أعد المحاولة" أو "اختر وسيلة أخرى"
  → السلة + العنوان + الشحن محفوظون
  → log في error_logs + payment.failed event
```
انظر [`ERRORS.md`](./ERRORS.md) للتفاصيل.

### 4.5 تتبع الطلب
```
رابط في إيميل/SMS → /order/track/$number
  → عرض timeline (created → paid → processing → shipped → delivered)
  → tracking_number + رابط شركة الشحن
  → خيار "تواصل مع الدعم"
```
متاح بدون login (token في الرابط).

### 4.6 طلب استرجاع
```
/account/orders/$id → "طلب إرجاع"
  → اختيار العناصر + الكمية + السبب
  → رفع صور (اختياري)
  → اختيار طريقة الاسترداد (نفس وسيلة الدفع)
  → تأكيد → RMA رقم
  → جدولة استلام → SMS تأكيد
```

### 4.7 التواصل مع الدعم
```
أي صفحة → زر WhatsApp العائم
  أو
/support/new → اختيار فئة (طلب/منتج/دفع/شحن/أخرى)
  → ربط بطلب (اختياري) → الرسالة + مرفقات
  → ticket_number → تتبّع في /support/$id
  → إشعار عند ردّ الموظف
```

---

## 5. Admin Flows

### 5.1 إدارة طلب جديد
```
/admin/orders (queue: pending) → فتح → مراجعة المنتجات + العنوان
  → تأكيد المخزون → "اعتماد" → status=processing
  → إنشاء شحنة (أوتوماتيكي حسب القواعد) → طباعة الملصق
  → SMS للعميل
```

### 5.2 إنشاء طلب يدوي (Phone order)
```
/admin/orders/new
  → بحث عن عميل أو إنشاء جديد
  → إضافة منتجات (بحث SKU/اسم)
  → اختيار/إنشاء عنوان
  → اختيار طريقة الشحن
  → اختيار طريقة الدفع:
    ├─ "إرسال رابط دفع" → expiring URL → SMS/WhatsApp
    └─ COD مباشرة
  → حفظ → الطلب يدخل nفس الـ pipeline
```

### 5.3 تعديل طلب
```
/admin/orders/$id → "تعديل"
  → السماح فقط قبل الشحن
  → تغيير العنوان / الكمية / منتج (مع تأكيد كل تغيير)
  → كل تغيير يُسجَّل في audit_logs
  → فرق السعر يُعالَج (charge إضافي / partial refund)
```

### 5.4 إنشاء شحنة
```
/admin/orders/$id → "إنشاء شحنة"
  → اختيار المستودع (auto حسب priority)
  → اختيار الناقل (smsa/aramex/spl)
  → استدعاء API → استلام tracking_number + label PDF
  → status=shipped → SMS
  → فشل → fallback ناقل آخر أو مهمة يدوية
```

### 5.5 تنفيذ Refund
```
/admin/orders/$id → "استرداد"
  → اختيار كامل/جزئي + المبلغ
  → سبب → ملاحظات
  → استدعاء payment provider API
  → Webhook نجاح → refunds.completed + audit
  → SMS + Email للعميل
```

### 5.6 إدارة منتج
```
/admin/products/new
  → بيانات أساسية (اسم AR/EN, slug, brand, SKU, category)
  → السعر + compare_at_price + cost
  → الوصف + المواصفات (rich editor)
  → الصور (drag-drop, optimize, تحديد الرئيسية)
  → المتغيّرات (لون × مقاس) → SKU لكل
  → SEO (meta, OG image)
  → Save as draft / Publish
```

### 5.7 إنشاء كوبون
```
/admin/coupons/new
  → الكود (أو توليد) + النوع (%/مبلغ/شحن مجاني)
  → القيمة + الحد الأدنى للطلب + الحد الأقصى للخصم
  → عدد مرات الاستخدام (إجمالي + لكل عميل)
  → التواريخ + الفئات/المنتجات المستهدفة
  → segments (عميل جديد / VIP / محدد)
  → معاينة + Save
```

### 5.8 مراجعة تقرير مبيعات
```
/admin/reports → اختيار "Sales"
  → فلتر فترة + قناة + فئة + موظف بيع
  → عرض charts + جدول
  → تصدير CSV/Excel/PDF
  → جدولة إرسال أسبوعي للإدارة
```

### 5.9 التعامل مع سلة متروكة
```
trigger cart.abandoned (بعد 4 ساعات)
  → email تلقائي 1 (تذكير)
  → بعد 24س: email 2 + كوبون 5%
  → بعد 72س: email 3 (آخر فرصة)
  → /admin/marketing/abandoned يعرض السلات + معدل الاسترجاع
```

---

## 6. Wireframes نصية

### Home (Mobile)
```
┌─────────────────────┐
│ ☰  LOGO    🔍 🛒(2)│  ← Header sticky
├─────────────────────┤
│   HERO BANNER       │  ← lazy carousel
│   "تشكيلة الشتاء"   │
│   [تسوّقي الآن]    │
├─────────────────────┤
│ الفئات (scroll أفقي)│  ← chips
│ [حقائب][أحذية][...] │
├─────────────────────┤
│ الأكثر مبيعاً       │
│ ┌────┬────┐         │  ← grid 2 cols
│ │card│card│         │
│ └────┴────┘         │
├─────────────────────┤
│ بانر CTA            │
├─────────────────────┤
│ مقالات / Look book  │
├─────────────────────┤
│   FOOTER            │
├─────────────────────┤
│ 🏠 🔍 ❤ 🛒 👤      │  ← Bottom nav
└─────────────────────┘
```

### Product Page
```
┌─────────────────────┐
│ ← Header   🔍 🛒    │
├─────────────────────┤
│ [Gallery: swipeable]│
│   • • ○ ○           │
├─────────────────────┤
│ Brand               │
│ اسم المنتج          │
│ ⭐⭐⭐⭐⭐ (124)   │
│ 350 ر.س ~~450~~ -22%│
├─────────────────────┤
│ اللون: [○][●][○]    │
│ المقاس: [S][M][L]   │
│ الكمية: [-][1][+]   │
├─────────────────────┤
│ [أضف للسلة]  ← CTA  │
│ [Apple Pay]         │
├─────────────────────┤
│ ▸ الوصف             │
│ ▸ المواصفات         │
│ ▸ الشحن والإرجاع    │
├─────────────────────┤
│ منتجات مشابهة       │
└─────────────────────┘
```

### Bag (Drawer)
```
┌─────────────────────┐
│ السلة (3)        ✕  │
├─────────────────────┤
│ [img] اسم المنتج    │
│       350 ر.س       │
│       [-][2][+]  🗑 │
├─────────────────────┤
│ ...                 │
├─────────────────────┤
│ [كود الخصم]  [طبّق] │
├─────────────────────┤
│ Subtotal:  700 ر.س  │
│ Shipping:  مجاني    │
│ ───────────────     │
│ Total:    700 ر.س   │
├─────────────────────┤
│ [Checkout — 700]    │
└─────────────────────┘
```

### Checkout (3 خطوات)
```
[1●━━━2○━━━3○]  العنوان · الشحن · الدفع

العنوان:
┌─────────────────────┐
│ ◉ المنزل (افتراضي)  │
│   الرياض، حي العليا │
├─────────────────────┤
│ ○ العمل             │
├─────────────────────┤
│ + إضافة عنوان جديد  │
└─────────────────────┘
[التالي]
```

### Order Track
```
طلب #12345                ✓ تم الدفع
─────────────────────
●━━━●━━━●━━━○━━━○
استلم  حُضِّر  شحن  جارٍ  وصل
─────────────────────
SMSA — 1234567890
[تتبع لدى الناقل]
─────────────────────
الوصول المتوقع: 28 أبريل
─────────────────────
[تواصل مع الدعم]
```

### Admin Dashboard
```
┌──────────────────────────────────┐
│ Sidebar │  KPIs (4 cards)         │
│         │  ┌────┬────┬────┬────┐ │
│ 🏠 Dash │  │طلب │ بيع │AOV │معد│ │
│ 📦 Ord  │  └────┴────┴────┴────┘ │
│ 🛍 Prd  │                         │
│ 📊 Inv  │  Sales chart (7 days)   │
│ 👥 Cus  │                         │
│ 🎫 Cou  │  Recent orders table    │
│ 📈 Rep  │                         │
│ ⚙ Set  │  Low stock | Errors     │
└──────────────────────────────────┘
```

---

## 7. وصف UI لكل صفحة

| الصفحة | المكوّنات الرئيسية | حالات خاصة |
|---|---|---|
| Home | Hero, Categories chips, Bestsellers grid, CTA banner, Editorial blocks | Empty (no products) |
| Category | Filter sidebar (mobile drawer), Sort dropdown, Product grid, Pagination/infinite | No results, loading skeleton |
| Product | Gallery, Title, Price, Variants, CTA sticky bottom (mobile), Tabs, Reviews | Out of stock badge, Coming soon |
| Search | Search bar sticky, Suggestions dropdown, Results grid | No results + suggestions |
| Bag | List items, Coupon, Summary, CTA | Empty bag illustration |
| Checkout | Steps indicator, Form, Order summary sidebar (desktop) | Auth gate, Validation errors |
| Account | Side tabs (desktop), Bottom tabs (mobile), Cards | Empty orders/wishlist |
| Order Detail | Status timeline, Items, Address, Payment, Actions | Cancelled/Refunded states |
| Admin Dashboard | Sidebar, KPI cards, Charts, Recent activity | Loading skeleton, error fallback |

تفاصيل الحالات في [`STATES.md`](./STATES.md).

---

## 8. مكوّنات Design System

**Tokens (`src/styles.css`):**
- Colors: `--primary`, `--primary-glow`, `--secondary`, `--accent`, `--bg`, `--fg`, `--muted`, `--border`, `--success`, `--warning`, `--destructive` (oklch).
- Spacing scale: 4/8/12/16/24/32/48/64.
- Radius: sm/md/lg/xl + full.
- Shadows: `--shadow-elegant`, `--shadow-card`.
- Typography: Tajawal (AR), Inter (EN). Sizes: 12/14/16/18/20/24/32/48.
- Motion: durations (fast/normal/slow), easing (ease-out preferred).

**Components (shadcn-based):**
- Button (primary/secondary/ghost/destructive/premium gradient).
- Input, Textarea, Select, Combobox, Switch, Checkbox, Radio, Slider.
- Card, Badge, Chip, Avatar, Skeleton.
- Dialog, Drawer, Sheet, Popover, Tooltip, Toast (Sonner).
- Tabs, Accordion, Collapsible.
- Table (sortable, paginated), DataTable.
- Form (with react-hook-form + zod).
- ProductCard, CategoryChip, PriceTag, RatingStars, QtyStepper.
- AddressCard, OrderTimeline, PaymentMethodCard.
- StatusBadge (orders/payments/shipments).
- EmptyState, ErrorState, LoadingState.
- MobileHeader, MobileBottomNav, ApplePayBadge, WhatsAppButton.

**القواعد:**
- لا ألوان مباشرة — فقط tokens.
- كل interactive element ≥ 44×44px على الجوال.
- RTL by default — استخدم `start/end` بدل `left/right`.

---

## 9. لوحة الإدارة — تفاصيل

**Layout:** sidebar (desktop) + drawer (mobile)، topbar فيها بحث عام + إشعارات + user menu.

**الأقسام:**
1. **Dashboard:** KPIs اليوم/الشهر، charts، آخر 10 طلبات، تنبيهات (مخزون منخفض، أخطاء).
2. **Orders:** queue + tabs بالحالة + فلاتر متقدمة + bulk actions.
3. **Products / Categories / Inventory.**
4. **Customers / Reviews / Support.**
5. **Marketing:** Coupons, CMS, Landing pages, Abandoned carts, Email campaigns.
6. **Reports:** sales, inventory, customers, marketing.
7. **Logs:** errors, emails, notifications, webhooks, audit.
8. **Settings:** users/roles, integrations, theme, payment, shipping.

**صلاحيات per route** عبر `_authenticated/_admin` layout + `has_permission`.

---

## 10. صفحة إدارة الطلبات — تفاصيل

```
/admin/orders
┌──────────────────────────────────────────┐
│ Tabs: [الكل][جديد][قيد التحضير][مشحون] │
├──────────────────────────────────────────┤
│ Filters: تاريخ | حالة دفع | ناقل | بحث  │
├──────────────────────────────────────────┤
│ Bulk: [اعتماد][طباعة][تصدير]           │
├──────────────────────────────────────────┤
│ #     عميل      المبلغ  الحالة   ⋮      │
│ 12345 سارة      350    paid     ⋮      │
│ 12346 نورة      280    pending  ⋮      │
└──────────────────────────────────────────┘
```

**صفحة الطلب الواحد `/admin/orders/$id`:**
- Header: رقم الطلب + بادج الحالة + actions (تعديل، شحن، إلغاء، استرداد).
- العميل (بطاقة + رابط لملفه).
- العنوان (مع زر تعديل + خريطة).
- المنتجات (جدول مع snapshots).
- ملخص مالي (subtotal/discount/shipping/tax/total).
- الدفع (المزود + provider_ref + الحالة).
- الشحن (الناقل + tracking + timeline).
- ملاحظات داخلية (timeline قابل للتعديل).
- Audit trail (آخر 20 تغيير).
- Activity feed (إيميلات/رسائل أُرسلت).

---

## 11. Checkout — تفاصيل

**3 خطوات** + ملخص دائم على اليمين (desktop) / أسفل (mobile).

**خطوة 1 — العنوان:**
- مسجّل: عناوين محفوظة + radio + "+ جديد".
- ضيف: حقول كاملة + خريطة لتحديد الموقع.
- Validation فوري + اقتراح المدينة من الـ IP.
- زر "متابعة كضيف" (لا يجبر التسجيل).

**خطوة 2 — الشحن:**
- خيارات الشحن من API (سعر + ETA) لكل ناقل متاح في المدينة.
- اختيار افتراضي = الأرخص.
- رسالة "العنوان خارج النطاق" مع اقتراح بدائل.

**خطوة 3 — الدفع:**
- Apple Pay (Safari iOS) — في الأعلى.
- mada/Visa (tokenized iframe).
- STC Pay (OTP).
- COD (إذا متاح + رسوم إضافية).
- Idempotency key لكل submit.
- 3DS modal.
- "أنا أوافق على الشروط" checkbox مع رابط.

**ملخص الطلب (دائم):**
- العناصر (مصغّرة).
- Coupon input.
- Subtotal/Discount/Shipping/Tax/Total.
- "آمن — مشفّر SSL" badge.

**حالات حرجة:** [`ERRORS.md`](./ERRORS.md) §K1-K17 في [`TEST_PLAN.md`](./TEST_PLAN.md).

---

## 12. التكاملات

| الفئة | المزوّد | الغرض | Secret name |
|---|---|---|---|
| Payments | mada/Visa via Tap/Moyasar/Tabby | بطاقات + STC + Apple Pay + BNPL | `PAYMENT_*` |
| Shipping | SMSA, Aramex, SPL | إنشاء شحنات + تتبع | `SHIPPING_*` |
| SMS | Unifonic / Twilio | OTP + إشعارات | `SMS_API_KEY` |
| WhatsApp | Meta Cloud API | قوالب رسائل | `WHATSAPP_TOKEN` |
| Email | Resend / SendGrid | transactional + marketing | `EMAIL_API_KEY` |
| Maps | Google Maps / Mapbox | تحديد الموقع | `MAPS_KEY` (publishable) |
| Analytics | GA4 + Meta Pixel | تتبع | publishable |
| AI | Lovable AI Gateway | بحث/توصيات | `LOVABLE_API_KEY` |
| ZATCA | Fatoorah | فواتير ضريبية | `ZATCA_*` |

كلها تمر عبر `/admin/integrations` لتفعيل/تعطيل + health check. تفاصيل في [`API.md`](./API.md).

---

## 13. التقارير

**أنواع:**
1. **Sales:** يومي/أسبوعي/شهري، حسب القناة/الفئة/الموظف.
2. **Inventory:** المخزون الحالي، حركة، منخفض، الأكثر دوراناً.
3. **Customers:** جدد vs متكررين، LTV, segments, churn.
4. **Marketing:** أداء الكوبونات, ROI الحملات, السلات المتروكة, conversion funnel.
5. **Financial:** إيرادات، استردادات، ضريبة، payouts.
6. **Operations:** وقت تجهيز الطلب، أداء الناقلين، معدل الإرجاع.

**ميزات:**
- فلاتر تاريخ + multi-dimensional.
- charts + tables.
- تصدير CSV/Excel/PDF (UTF-8 BOM للعربية).
- جدولة إرسال (cron) للإدارة.
- مقارنة فترات (هذا الأسبوع vs السابق).

---

## 14. حالات الخطأ

كل خطأ موثَّق في [`ERRORS.md`](./ERRORS.md) مع:
- رسالة العميل (عربية واضحة).
- رسالة الإدارة (تفصيلية).
- log في `error_logs`.
- إجراء مقترح.
- ضمان عدم ضياع البيانات.

**الفئات:** payment, inventory, shipping, location, sms, whatsapp, webhook, network, system.

---

## 15. متطلبات الأمان

ملخص (التفاصيل في [`SECURITY.md`](./SECURITY.md)):
- Auth: email+password + Google + HIBP check + lockout بعد 5 محاولات.
- Roles في جدول منفصل + `has_role()` SECURITY DEFINER.
- RLS على كل الجداول.
- PII masking للموظفين بدون صلاحية.
- Audit logs immutable.
- Webhooks: HMAC signature + idempotency.
- Secrets خارج الكود.
- HTTPS + HSTS + secure cookies.
- Cookie consent + privacy policy + unsubscribe.
- Rate limiting على endpoints حساسة.

---

## 16. متطلبات الأداء

ملخص (التفاصيل في [`PERFORMANCE.md`](./PERFORMANCE.md)):
- LCP < 2.5s (p75).
- INP < 200ms.
- CLS < 0.1.
- TTFB < 600ms.
- صور WebP/AVIF + lazy + responsive srcset.
- Code splitting لكل route.
- DB indexes على الحقول المفلترة.
- Cache للقوائم الشائعة (categories, settings).
- CDN للأصول الثابتة.

---

## 17. خطة MVP (8 أسابيع)

**هدف:** متجر قابل للتشغيل التجاري بأقل ميزات ضرورية.

### Sprint 1-2 (أسبوع 1-2): الأساس
- Auth (email + Google).
- Schema الأساسي (products, categories, orders, profiles, addresses, user_roles).
- Admin shell + Dashboard أولي.
- إدارة منتجات + فئات.
- Home + Category + Product pages.

### Sprint 3-4 (أسبوع 3-4): التسوّق
- Bag + Checkout (3 خطوات).
- تكامل دفع واحد (Tap/Moyasar) + COD + Apple Pay.
- تكامل ناقل واحد (SMSA).
- Order success + email تأكيد.
- صفحة /account/orders.

### Sprint 5-6 (أسبوع 5-6): العمليات
- Admin Orders (queue + detail + actions).
- إنشاء شحنة + tracking page.
- Refunds (كامل/جزئي).
- Returns (basic flow).
- SMS notifications.

### Sprint 7 (أسبوع 7): التهيئة
- SEO (sitemap, robots, schema).
- Mobile polish (bottom nav, touch targets).
- RTL audit.
- Privacy + Terms + Cookie banner.
- Performance tuning.

### Sprint 8 (أسبوع 8): UAT + Launch
- Test plan كامل.
- Security scan.
- Soft launch (10 عملاء حقيقيين).
- مراقبة + إصلاحات.
- Public launch.

**خارج MVP:** WhatsApp، coupons المتقدمة، wishlist، reviews، landing pages، multi-warehouse، AI search.

---

## 18. خطة V2 (3-6 أشهر بعد الإطلاق)

**التحسينات:**
- WhatsApp Business API (إشعارات + ردود تلقائية).
- Reviews + UGC.
- Wishlist + Save for later.
- نقاط الولاء + Tiered membership.
- Coupons متقدمة (segments, BOGO, bundle).
- Landing pages + A/B testing.
- AI: توصيات شخصية + بحث semantic.
- Multi-warehouse + smart routing.
- Live chat (Intercom-like).
- Subscriptions (للمنتجات المتكررة).
- Mobile app (React Native).
- Multi-language (EN كامل).
- ZATCA Phase 2.
- Affiliate program.

---

## 19. Backlog مقترح (Prioritized)

| # | Epic | الميزة | الأولوية | Sprint |
|---|---|---|---|---|
| 1 | Auth | Email/password + Google | P0 | 1 |
| 2 | Catalog | Products CRUD | P0 | 1 |
| 3 | Catalog | Categories tree | P0 | 1 |
| 4 | Storefront | Home + Category + Product | P0 | 2 |
| 5 | Storefront | Search + autocomplete | P0 | 2 |
| 6 | Bag | Add/edit/coupon | P0 | 3 |
| 7 | Checkout | 3 steps + Apple Pay | P0 | 3 |
| 8 | Payment | Tap/Moyasar + COD | P0 | 4 |
| 9 | Shipping | SMSA integration | P0 | 4 |
| 10 | Account | Orders list + detail | P0 | 4 |
| 11 | Admin | Orders queue + detail | P0 | 5 |
| 12 | Admin | Manual order + payment link | P0 | 5 |
| 13 | Admin | Refund flow | P0 | 6 |
| 14 | Returns | Customer + admin flow | P0 | 6 |
| 15 | Notifications | Email + SMS transactional | P0 | 6 |
| 16 | SEO | Meta + sitemap + schema | P0 | 7 |
| 17 | Privacy | Policy + consent + unsubscribe | P0 | 7 |
| 18 | Performance | Image optimization + caching | P0 | 7 |
| 19 | Mobile | Bottom nav + touch UX | P0 | 7 |
| 20 | Coupons | Basic coupons | P1 | V1.1 |
| 21 | Wishlist | | P1 | V2 |
| 22 | Reviews | | P1 | V2 |
| 23 | WhatsApp | Templates | P1 | V2 |
| 24 | Loyalty | Points + tiers | P2 | V2 |
| 25 | AI | Recommendations | P2 | V2 |
| 26 | A/B | Landing testing | P2 | V2 |
| 27 | ZATCA | Phase 2 | P1 | V1.5 |
| 28 | Multi-warehouse | | P2 | V2 |
| 29 | Mobile App | RN | P3 | V3 |

---

## 20. Acceptance Criteria — أمثلة لكل ميزة كبرى

### Auth — تسجيل دخول
- [ ] يتحقّق من البريد + كلمة المرور server-side.
- [ ] HIBP check يرفض كلمات مسرّبة.
- [ ] قفل الحساب بعد 5 محاولات فاشلة لمدة 30 دقيقة.
- [ ] الرسائل بالعربية، لا تكشف "هل البريد موجود".
- [ ] redirect لـ `?redirect=` إن وُجد.
- [ ] mobile-friendly (44px buttons).
- [ ] log في `failed_login_attempts`.

### Add to Cart
- [ ] يضيف المنتج/المتغيّر للسلة الحالية.
- [ ] يمنع تجاوز المخزون مع رسالة "المتوفر فقط N".
- [ ] Drawer يفتح من اليمين (RTL).
- [ ] Toast نجاح + زر "Checkout".
- [ ] Persist بين sessions (مسجّل) أو session_id (ضيف).
- [ ] دمج عند تسجيل الدخول.

### Checkout — Apple Pay
- [ ] الزر يظهر فقط على Safari iOS مع شهادة merchant صالحة.
- [ ] tokenization client-side (لا بيانات بطاقة تصل سيرفرنا).
- [ ] Idempotency key يمنع الدفع المكرر.
- [ ] 3DS modal يعمل.
- [ ] Success → /order/success/$id.
- [ ] Failure → رسالة محددة + السلة محفوظة.

### Refund
- [ ] متاح لـ admin/manager فقط.
- [ ] لا يتجاوز قيمة الدفع الأصلي.
- [ ] جزئي/كامل + سبب إجباري.
- [ ] استدعاء provider API + handle webhook نجاح/فشل.
- [ ] تحديث `payment_status` (refunded/partially_refunded).
- [ ] إيميل + SMS للعميل.
- [ ] log في `audit_logs` تلقائياً.

### Order Tracking (عام)
- [ ] لا يحتاج login (token في الرابط).
- [ ] يعرض timeline الحالة.
- [ ] tracking_number + رابط الناقل.
- [ ] ETA إن متوفّر.
- [ ] زر "تواصل مع الدعم" يفتح ticket مرتبط بالطلب.
- [ ] mobile-first.

### Admin — Manual Order
- [ ] بحث عن عميل أو إنشاء جديد inline.
- [ ] إضافة منتجات بالبحث (SKU/اسم).
- [ ] حساب تلقائي للشحن والضريبة.
- [ ] خياران للدفع: COD فوري أو إرسال رابط دفع expiring.
- [ ] الطلب يظهر في نفس queue الطلبات العادية.
- [ ] log في `audit_logs` مع actor.

### Coupon
- [ ] الكود فريد (case-insensitive).
- [ ] التحقق server-side (لا client-side).
- [ ] احترام حدود usage_limit + per_customer.
- [ ] احترام min_order و expires_at.
- [ ] applies_to (categories/products) يعمل.
- [ ] redemption تُسجَّل في `coupon_redemptions`.
- [ ] رسائل خطأ محددة (انظر [`ERRORS.md`](./ERRORS.md)).

### Reports — Sales
- [ ] فلتر تاريخ + قناة + فئة.
- [ ] يحسب فقط `payment_status=paid` (يستثني المرتجعات).
- [ ] charts (line + bar) + جدول مفصّل.
- [ ] تصدير CSV (UTF-8 BOM) + Excel + PDF.
- [ ] جدولة إرسال أسبوعي.
- [ ] صلاحية `reports.view_sales`.

### Privacy / Cookie Consent
- [ ] Banner يظهر للزائر الجديد فقط.
- [ ] خيارات: قبول الكل / الضرورية فقط / تخصيص.
- [ ] قبل الموافقة: لا analytics، لا marketing pixels.
- [ ] الموافقة محفوظة 12 شهر.
- [ ] رابط للسياسة في كل صفحة (footer).
- [ ] /unsubscribe يعمل بدون login.

---

## ملاحظات ختامية

- جميع الأرقام والأهداف قابلة للضبط بعد أول 30 يوم من البيانات الفعلية.
- خطة MVP محافظة عمداً — التركيز على **الإطلاق الموثوق** قبل التوسّع.
- كل ميزة V2 يجب أن تُختبر فرضياتها بـ analytics قبل البناء.
- مراجعة شهرية للـ backlog مع فريق المنتج.
