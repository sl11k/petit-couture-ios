import type { AdminPageConfig } from "@/features/admin/types";
import { ProductNameCell } from "@/features/admin/components/ProductNameCell";

const yesNo = [
  { value: "true", label: { ar: "نعم", en: "Yes" } },
  { value: "false", label: { ar: "لا", en: "No" } },
];

// Reusable lookup configs ─ keeps the form definitions tidy
const productLookup = {
  table: "products",
  labelColumns: ["name_ar", "name_en"],
  secondaryColumn: "sku",
  imageColumn: "image_url",
  searchColumns: ["name_ar", "name_en", "sku"],
  filter: { is_active: true },
  limit: 100,
} as const;

const customerLookup = {
  table: "profiles",
  labelColumns: ["full_name", "email"],
  secondaryColumn: "phone",
  searchColumns: ["full_name", "email", "phone"],
  limit: 100,
} as const;

const carrierLookup = {
  table: "shipping_carriers",
  labelColumns: ["name_ar", "name_en"],
  secondaryColumn: "code",
  imageColumn: "logo_url",
  filter: { is_active: true },
  limit: 100,
} as const;

const zoneLookup = {
  table: "shipping_zones",
  labelColumns: ["name_ar", "name_en"],
  secondaryColumn: "country_code",
  filter: { is_active: true },
  limit: 100,
} as const;

// ───────── Bundles ─────────
export const bundlesConfig: AdminPageConfig = {
  title: { ar: "الباقات", en: "Bundles" },
  description: { ar: "باقات منتجات بسعر مخفّض", en: "Product bundles with discounted price" },
  table: "bundles",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "bundle_price", label: { ar: "السعر", en: "Price" }, type: "currency" },
    { key: "discount_percent", label: { ar: "خصم %", en: "Discount %" }, type: "number", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean" },
    { key: "starts_at", label: { ar: "تبدأ", en: "Starts" }, type: "date", hideOnMobile: true },
    { key: "ends_at", label: { ar: "تنتهي", en: "Ends" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name", "description"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true, maxLength: 200 },
    { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 3 },
    { key: "bundle_price", label: { ar: "سعر الباقة", en: "Bundle price" }, type: "number", required: true, min: 0, step: 0.01 },
    { key: "discount_percent", label: { ar: "نسبة الخصم %", en: "Discount %" }, type: "number", min: 0, max: 100, step: 0.01 },
    {
      key: "product_ids",
      label: { ar: "المنتجات في الباقة", en: "Products in the bundle" },
      type: "lookup",
      lookup: { ...productLookup, multiple: true },
      helpText: { ar: "ابحث وأضف عدة منتجات", en: "Search and add multiple products" },
    },
    { key: "starts_at", label: { ar: "تبدأ", en: "Starts at" }, type: "datetime" },
    { key: "ends_at", label: { ar: "تنتهي", en: "Ends at" }, type: "datetime" },
    { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Product offers ─────────
export const productOffersConfig: AdminPageConfig = {
  title: { ar: "عروض المنتجات", en: "Product Offers" },
  description: { ar: "عروض موجّهة لمنتج واحد (BxGy، خصم، شحن مجاني …)", en: "Per-product offers (BxGy, discount, free shipping…)" },
  table: "product_offers",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "product_id", label: { ar: "المنتج", en: "Product" } },
    { key: "offer_type", label: { ar: "النوع", en: "Type" }, type: "badge" },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
    { key: "starts_at", label: { ar: "يبدأ", en: "Starts" }, type: "date", hideOnMobile: true },
    { key: "ends_at", label: { ar: "ينتهي", en: "Ends" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["offer_type"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
    {
      key: "offer_type", type: "select", label: { ar: "النوع", en: "Type" },
      options: [
        { value: "bxgy", label: { ar: "اشتر X واحصل على Y", en: "BxGy" } },
        { value: "discount", label: { ar: "خصم نسبي/ثابت", en: "Discount" } },
        { value: "free_shipping", label: { ar: "شحن مجاني", en: "Free shipping" } },
        { value: "bundle", label: { ar: "باقة", en: "Bundle" } },
      ],
    },
  ],
  form: [
    {
      key: "product_id",
      label: { ar: "المنتج", en: "Product" },
      type: "lookup",
      required: true,
      lookup: productLookup,
    },
    { key: "offer_type", label: { ar: "نوع العرض", en: "Offer type" }, type: "select", required: true,
      options: [
        { value: "bxgy", label: { ar: "اشتر X واحصل على Y", en: "BxGy" } },
        { value: "discount", label: { ar: "خصم", en: "Discount" } },
        { value: "free_shipping", label: { ar: "شحن مجاني", en: "Free shipping" } },
        { value: "bundle", label: { ar: "باقة", en: "Bundle" } },
      ] },
    // BxGy fields
    { key: "buy_quantity", label: { ar: "كمية الشراء (لعرض اشتر X)", en: "Buy quantity (for BxGy)" }, type: "number", min: 1, helpText: { ar: "املأ فقط لعرض BxGy", en: "Fill only for BxGy offers" } },
    { key: "get_quantity", label: { ar: "كمية الحصول (لعرض اشتر X واحصل على Y)", en: "Get quantity (BxGy)" }, type: "number", min: 1, helpText: { ar: "املأ فقط لعرض BxGy", en: "Fill only for BxGy offers" } },
    { key: "get_discount_percent", label: { ar: "نسبة خصم الحصول %", en: "Get discount %" }, type: "number", min: 0, max: 100, step: 0.01, helpText: { ar: "مثلاً 100 = مجاناً، 50 = نصف السعر", en: "100 = free, 50 = half price" } },
    // Discount fields
    { key: "discount_percent", label: { ar: "نسبة الخصم % (لعرض خصم)", en: "Discount % (for Discount)" }, type: "number", min: 0, max: 100, step: 0.01, helpText: { ar: "املأ نسبة أو مبلغ ثابت تحت", en: "Either percent here or fixed amount below" } },
    { key: "discount_amount", label: { ar: "مبلغ خصم ثابت", en: "Fixed discount amount" }, type: "number", min: 0, step: 0.01 },
    // Free shipping
    { key: "min_order_value", label: { ar: "أدنى قيمة طلب (لعرض شحن مجاني)", en: "Min order value (free shipping)" }, type: "number", min: 0, step: 0.01, helpText: { ar: "الطلب لازم يتجاوز هذا المبلغ", en: "Order must exceed this amount" } },
    // Bundle
    {
      key: "bundle_product_ids",
      label: { ar: "منتجات الباقة (لعرض باقة)", en: "Bundle products (for Bundle)" },
      type: "lookup",
      lookup: { ...productLookup, multiple: true },
      helpText: { ar: "اختر المنتجات المضمّنة في الباقة", en: "Pick the products bundled together" },
    },
    { key: "starts_at", label: { ar: "يبدأ", en: "Starts at" }, type: "datetime" },
    { key: "ends_at", label: { ar: "ينتهي", en: "Ends at" }, type: "datetime" },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Product relations ─────────
export const productRelationsConfig: AdminPageConfig = {
  title: { ar: "المنتجات المرتبطة", en: "Product Relations" },
  description: { ar: "اربط منتجاً بمنتج آخر — مرتبط أو مكمّل أو ترقية أو بديل", en: "Link products together — related, complementary, upsell, or alternative" },
  table: "product_relations",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "product_id", label: { ar: "المنتج الأصلي", en: "Source product" }, render: (v) => <ProductNameCell productId={v} /> },
    { key: "related_product_id", label: { ar: "المرتبط به", en: "Related product" }, render: (v) => <ProductNameCell productId={v} /> },
    { key: "relation_type", label: { ar: "نوع العلاقة", en: "Relation" }, type: "badge" },
    { key: "discount_percent", label: { ar: "خصم %", en: "Disc %" }, type: "number" },
    { key: "discount_amount", label: { ar: "خصم ثابت", en: "Disc amount" }, type: "number", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
    { key: "display_order", label: { ar: "الترتيب", en: "Order" }, type: "number", hideOnMobile: true },
  ],
  filters: [
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: [
      { value: "true", label: { ar: "نشط", en: "Active" } },
      { value: "false", label: { ar: "موقوف", en: "Inactive" } },
    ] },
    {
      key: "relation_type", type: "select", label: { ar: "نوع العلاقة", en: "Relation" },
      options: [
        { value: "related", label: { ar: "مرتبط", en: "Related" } },
        { value: "cross_sell", label: { ar: "مكمّل", en: "Cross-sell" } },
        { value: "upsell", label: { ar: "ترقية", en: "Upsell" } },
        { value: "alternative", label: { ar: "بديل", en: "Alternative" } },
      ],
    },
  ],
  form: [
    {
      key: "product_id",
      label: { ar: "المنتج الأصلي", en: "Source product" },
      type: "lookup",
      required: true,
      lookup: productLookup,
      helpText: { ar: "ابحث عن المنتج الذي تظهر علاقاته في صفحته", en: "Search for the product whose relations appear on its page" },
    },
    {
      key: "related_product_id",
      label: { ar: "المنتج المرتبط", en: "Related product" },
      type: "lookup",
      required: true,
      lookup: productLookup,
      helpText: { ar: "المنتج الذي سيُعرض كاقتراح للشراء معه", en: "The product that will be shown as a bundle suggestion" },
    },
    { key: "relation_type", label: { ar: "نوع العلاقة", en: "Relation type" }, type: "select", required: true,
      options: [
        { value: "related", label: { ar: "مرتبط", en: "Related" } },
        { value: "cross_sell", label: { ar: "مكمّل (اشتراه عملاء آخرون مع …)", en: "Cross-sell" } },
        { value: "upsell", label: { ar: "ترقية (نسخة أفضل / أغلى)", en: "Upsell (a better/pricier version)" } },
        { value: "alternative", label: { ar: "بديل", en: "Alternative" } },
      ], defaultValue: "related" },
    { key: "discount_percent", label: { ar: "نسبة الخصم %", en: "Discount %" }, type: "number", min: 0, max: 100,
      helpText: { ar: "خصم يُطبّق على المنتج المرتبط عند الشراء مع المنتج الأصلي (مثال: 20 = 20%)", en: "Discount applied to the related product when bought with the source (e.g. 20 = 20%)" } },
    { key: "discount_amount", label: { ar: "خصم ثابت (ر.س)", en: "Fixed discount (SAR)" }, type: "number", min: 0,
      helpText: { ar: "بديلاً عن النسبة — مبلغ خصم ثابت بالعملة", en: "Alternative to percent — a fixed currency discount" } },
    { key: "title_ar", label: { ar: "عنوان العرض (AR)", en: "Offer label (AR)" }, type: "text", maxLength: 100,
      placeholder: { ar: "مثال: وفّر 20% عند الشراء معاً", en: "" } },
    { key: "title_en", label: { ar: "عنوان العرض (EN)", en: "Offer label (EN)" }, type: "text", maxLength: 100,
      placeholder: { ar: "", en: "e.g. Save 20% when bought together" } },
    { key: "is_active", label: { ar: "مُفعّل", en: "Active" }, type: "boolean", defaultValue: true },
    { key: "display_order", label: { ar: "ترتيب الظهور", en: "Display order" }, type: "number", defaultValue: 0,
      helpText: { ar: "أرقام أقل تظهر أولاً", en: "Lower numbers appear first" } },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── A/B Tests ─────────
export const abTestsConfig: AdminPageConfig = {
  title: { ar: "اختبارات A/B", en: "A/B Tests" },
  table: "ab_tests",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "scope", label: { ar: "النطاق", en: "Scope" }, type: "badge" },
    { key: "views_a", label: { ar: "مشاهدات A", en: "Views A" }, type: "number", hideOnMobile: true },
    { key: "views_b", label: { ar: "مشاهدات B", en: "Views B" }, type: "number", hideOnMobile: true },
    { key: "conversions_a", label: { ar: "تحويلات A", en: "Conv. A" }, type: "number", hideOnMobile: true },
    { key: "conversions_b", label: { ar: "تحويلات B", en: "Conv. B" }, type: "number", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name", "scope"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true },
    { key: "scope", label: { ar: "النطاق", en: "Scope" }, type: "text", placeholder: { ar: "مثال: home_hero", en: "e.g. home_hero" } },
    { key: "variant_a", label: { ar: "الإصدار A", en: "Variant A" }, type: "json" },
    { key: "variant_b", label: { ar: "الإصدار B", en: "Variant B" }, type: "json" },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Notification rules ─────────
export const notificationRulesConfig: AdminPageConfig = {
  title: { ar: "قواعد الإشعارات", en: "Notification Rules" },
  table: "notification_rules",
  orderBy: { column: "event_code", ascending: true },
  columns: [
    { key: "event_code", label: { ar: "الحدث", en: "Event" } },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "badge" },
    { key: "trigger_mode", label: { ar: "التشغيل", en: "Trigger" }, type: "badge", hideOnMobile: true },
    { key: "delay_minutes", label: { ar: "تأخير (د)", en: "Delay (m)" }, type: "number", hideOnMobile: true },
    { key: "is_enabled", label: { ar: "مفعّلة", en: "Enabled" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["event_code", "description"] },
    { key: "is_enabled", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "event_code", label: { ar: "كود الحدث", en: "Event code" }, type: "text", required: true,
      placeholder: { ar: "مثال: order.created", en: "e.g. order.created" } },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "select", required: true,
      options: [
        { value: "customer", label: { ar: "العميل", en: "Customer" } },
        { value: "admin", label: { ar: "الأدمن", en: "Admin" } },
        { value: "staff", label: { ar: "الموظفون", en: "Staff" } },
      ], defaultValue: "customer" },
    { key: "channels", label: { ar: "القنوات", en: "Channels" }, type: "json",
      helpText: { ar: 'مثال: ["email","sms","push","in_app"]', en: 'e.g. ["email","sms","push","in_app"]' } },
    { key: "trigger_mode", label: { ar: "وضع التشغيل", en: "Trigger mode" }, type: "select",
      options: [
        { value: "immediate", label: { ar: "فوري", en: "Immediate" } },
        { value: "delayed", label: { ar: "مؤجّل", en: "Delayed" } },
        { value: "scheduled", label: { ar: "مجدول", en: "Scheduled" } },
      ], defaultValue: "immediate" },
    { key: "delay_minutes", label: { ar: "تأخير بالدقائق", en: "Delay (minutes)" }, type: "number", defaultValue: 0 },
    { key: "max_retries", label: { ar: "محاولات إعادة", en: "Max retries" }, type: "number", defaultValue: 3 },
    { key: "allow_resend", label: { ar: "السماح بإعادة الإرسال", en: "Allow resend" }, type: "boolean" },
    { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 2 },
    { key: "is_enabled", label: { ar: "مفعّلة", en: "Enabled" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Notification templates ─────────
export const notificationTemplatesConfig: AdminPageConfig = {
  title: { ar: "قوالب الإشعارات", en: "Notification Templates" },
  table: "notification_templates",
  orderBy: { column: "template_key", ascending: true },
  columns: [
    { key: "template_key", label: { ar: "المفتاح", en: "Key" } },
    { key: "event_code", label: { ar: "الحدث", en: "Event" } },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "badge" },
    { key: "language", label: { ar: "اللغة", en: "Lang" }, type: "badge", hideOnMobile: true },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "badge", hideOnMobile: true },
    { key: "is_enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["template_key", "event_code", "subject"] },
    { key: "channel", type: "select", label: { ar: "القناة", en: "Channel" },
      options: [
        { value: "email", label: { ar: "إيميل", en: "Email" } },
        { value: "sms", label: { ar: "SMS", en: "SMS" } },
        { value: "push", label: { ar: "إشعار دفع", en: "Push" } },
        { value: "in_app", label: { ar: "داخل التطبيق", en: "In-app" } },
        { value: "whatsapp", label: { ar: "واتساب", en: "WhatsApp" } },
      ] },
    { key: "language", type: "select", label: { ar: "اللغة", en: "Language" },
      options: [
        { value: "ar", label: { ar: "العربية", en: "Arabic" } },
        { value: "en", label: { ar: "الإنجليزية", en: "English" } },
      ] },
  ],
  form: [
    { key: "template_key", label: { ar: "المفتاح", en: "Template key" }, type: "text", required: true },
    { key: "event_code", label: { ar: "كود الحدث", en: "Event code" }, type: "text", required: true },
    { key: "channel", label: { ar: "القناة", en: "Channel" }, type: "select", required: true,
      options: [
        { value: "email", label: { ar: "إيميل", en: "Email" } },
        { value: "sms", label: { ar: "SMS", en: "SMS" } },
        { value: "push", label: { ar: "إشعار", en: "Push" } },
        { value: "in_app", label: { ar: "داخل التطبيق", en: "In-app" } },
        { value: "whatsapp", label: { ar: "واتساب", en: "WhatsApp" } },
      ] },
    { key: "language", label: { ar: "اللغة", en: "Language" }, type: "select",
      options: [
        { value: "ar", label: { ar: "العربية", en: "Arabic" } },
        { value: "en", label: { ar: "الإنجليزية", en: "English" } },
      ], defaultValue: "ar" },
    { key: "audience", label: { ar: "الجمهور", en: "Audience" }, type: "select",
      options: [
        { value: "customer", label: { ar: "العميل", en: "Customer" } },
        { value: "admin", label: { ar: "الأدمن", en: "Admin" } },
        { value: "staff", label: { ar: "الموظفون", en: "Staff" } },
      ], defaultValue: "customer" },
    { key: "subject", label: { ar: "العنوان", en: "Subject" }, type: "text" },
    { key: "body", label: { ar: "النص", en: "Body" }, type: "textarea", rows: 6 },
    { key: "body_html", label: { ar: "HTML", en: "HTML" }, type: "textarea", rows: 8 },
    { key: "variables", label: { ar: "المتغيرات", en: "Variables" }, type: "json" },
    { key: "description", label: { ar: "الوصف", en: "Description" }, type: "textarea", rows: 2 },
    { key: "is_enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Loyalty accounts ─────────
export const loyaltyAccountsConfig: AdminPageConfig = {
  title: { ar: "حسابات الولاء", en: "Loyalty Accounts" },
  table: "loyalty_accounts",
  orderBy: { column: "balance", ascending: false },
  columns: [
    { key: "user_id", label: { ar: "العميل", en: "Customer" } },
    { key: "tier", label: { ar: "المستوى", en: "Tier" }, type: "badge" },
    { key: "balance", label: { ar: "الرصيد", en: "Balance" }, type: "number" },
    { key: "lifetime_earned", label: { ar: "مجموع المكتسب", en: "Lifetime" }, type: "number", hideOnMobile: true },
    { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["user_id", "tier"] },
    { key: "tier", type: "select", label: { ar: "المستوى", en: "Tier" },
      options: [
        { value: "bronze", label: { ar: "برونزي", en: "Bronze" } },
        { value: "silver", label: { ar: "فضي", en: "Silver" } },
        { value: "gold", label: { ar: "ذهبي", en: "Gold" } },
        { value: "platinum", label: { ar: "بلاتيني", en: "Platinum" } },
      ] },
  ],
  form: [
    {
      key: "user_id",
      label: { ar: "العميل", en: "Customer" },
      type: "lookup",
      required: true,
      createOnly: true,
      lookup: customerLookup,
    },
    { key: "tier", label: { ar: "المستوى", en: "Tier" }, type: "select",
      options: [
        { value: "bronze", label: { ar: "برونزي", en: "Bronze" } },
        { value: "silver", label: { ar: "فضي", en: "Silver" } },
        { value: "gold", label: { ar: "ذهبي", en: "Gold" } },
        { value: "platinum", label: { ar: "بلاتيني", en: "Platinum" } },
      ], defaultValue: "bronze" },
    { key: "balance", label: { ar: "الرصيد", en: "Balance" }, type: "number", defaultValue: 0 },
    { key: "lifetime_earned", label: { ar: "مجموع المكتسب", en: "Lifetime earned" }, type: "number", defaultValue: 0 },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Loyalty transactions ─────────
export const loyaltyTransactionsConfig: AdminPageConfig = {
  title: { ar: "حركات الولاء", en: "Loyalty Transactions" },
  table: "loyalty_transactions",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "datetime" },
    { key: "user_id", label: { ar: "العميل", en: "User" } },
    { key: "delta", label: { ar: "التغيير", en: "Delta" }, type: "number" },
    { key: "reason", label: { ar: "السبب", en: "Reason" }, type: "badge" },
    { key: "related_id", label: { ar: "مرجع", en: "Ref" }, hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["user_id", "reason", "related_id"] },
  ],
  form: [
    {
      key: "user_id",
      label: { ar: "العميل", en: "Customer" },
      type: "lookup",
      required: true,
      lookup: customerLookup,
    },
    { key: "delta", label: { ar: "التغيير (+/-)", en: "Delta (+/-)" }, type: "number", required: true },
    { key: "reason", label: { ar: "السبب", en: "Reason" }, type: "text", required: true,
      placeholder: { ar: "purchase / refund / manual / redeem", en: "purchase / refund / manual / redeem" } },
    { key: "related_id", label: { ar: "مرجع (طلب…)", en: "Related ID" }, type: "text" },
    { key: "metadata", label: { ar: "بيانات إضافية", en: "Metadata" }, type: "json" },
  ],
  actions: { create: true, edit: false, delete: true, export: true },
};

// ───────── Referrals ─────────
export const referralsConfig: AdminPageConfig = {
  title: { ar: "الإحالات", en: "Referrals" },
  table: "referrals",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "referral_code", label: { ar: "الكود", en: "Code" } },
    { key: "referrer_user_id", label: { ar: "المُحيل", en: "Referrer" }, hideOnMobile: true },
    { key: "referred_email", label: { ar: "الإيميل", en: "Email" } },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "reward_amount", label: { ar: "المكافأة", en: "Reward" }, type: "currency", hideOnMobile: true },
    { key: "created_at", label: { ar: "تاريخ", en: "Date" }, type: "date", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["referral_code", "referred_email"] },
    { key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "pending", label: { ar: "بانتظار", en: "Pending" } },
        { value: "registered", label: { ar: "مُسجَّل", en: "Registered" } },
        { value: "rewarded", label: { ar: "مُكافأ", en: "Rewarded" } },
        { value: "expired", label: { ar: "منتهي", en: "Expired" } },
      ] },
  ],
  form: [
    {
      key: "referrer_user_id",
      label: { ar: "العميل المُحيل", en: "Referrer" },
      type: "lookup",
      required: true,
      lookup: customerLookup,
    },
    { key: "referral_code", label: { ar: "كود الإحالة", en: "Referral code" }, type: "text", required: true, maxLength: 64 },
    { key: "referred_email", label: { ar: "إيميل المُحال", en: "Referred email" }, type: "email" },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select",
      options: [
        { value: "pending", label: { ar: "بانتظار", en: "Pending" } },
        { value: "registered", label: { ar: "مُسجَّل", en: "Registered" } },
        { value: "rewarded", label: { ar: "مُكافأ", en: "Rewarded" } },
        { value: "expired", label: { ar: "منتهي", en: "Expired" } },
      ], defaultValue: "pending" },
    { key: "reward_amount", label: { ar: "المكافأة", en: "Reward amount" }, type: "number", min: 0, step: 0.01, defaultValue: 0 },
    { key: "reward_type", label: { ar: "نوع المكافأة", en: "Reward type" }, type: "select",
      options: [
        { value: "credit", label: { ar: "رصيد", en: "Credit" } },
        { value: "discount", label: { ar: "خصم", en: "Discount" } },
        { value: "points", label: { ar: "نقاط", en: "Points" } },
      ], defaultValue: "credit" },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── FAQ ─────────
export const faqItemsConfig: AdminPageConfig = {
  title: { ar: "الأسئلة الشائعة", en: "FAQ Items" },
  table: "faq_items",
  orderBy: { column: "sort_order", ascending: true },
  columns: [
    { key: "sort_order", label: { ar: "#", en: "#" }, type: "number", width: "w-12" },
    { key: "category", label: { ar: "التصنيف", en: "Category" }, type: "badge", hideOnMobile: true },
    { key: "question_ar", label: { ar: "السؤال (عربي)", en: "Question (AR)" } },
    { key: "question_en", label: { ar: "السؤال (إنجليزي)", en: "Question (EN)" }, hideOnMobile: true },
    { key: "is_enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["question_ar", "question_en", "category"] },
    { key: "is_enabled", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "category", label: { ar: "التصنيف", en: "Category" }, type: "text",
      placeholder: { ar: "shipping / returns / payment …", en: "shipping / returns / payment …" } },
    { key: "question_ar", label: { ar: "السؤال (عربي)", en: "Question (AR)" }, type: "text", required: true },
    { key: "answer_ar", label: { ar: "الإجابة (عربي)", en: "Answer (AR)" }, type: "textarea", rows: 5, required: true },
    { key: "question_en", label: { ar: "السؤال (إنجليزي)", en: "Question (EN)" }, type: "text" },
    { key: "answer_en", label: { ar: "الإجابة (إنجليزي)", en: "Answer (EN)" }, type: "textarea", rows: 5 },
    { key: "sort_order", label: { ar: "الترتيب", en: "Sort order" }, type: "number", defaultValue: 0 },
    { key: "is_enabled", label: { ar: "مفعّل", en: "Enabled" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Reviews (moderation) ─────────
export const reviewsConfig: AdminPageConfig = {
  title: { ar: "إدارة التقييمات", en: "Reviews Moderation" },
  table: "reviews",
  orderBy: { column: "created_at", ascending: false },
  columns: [
    { key: "created_at", label: { ar: "التاريخ", en: "Date" }, type: "date" },
    { key: "product_id", label: { ar: "المنتج", en: "Product" }, hideOnMobile: true },
    { key: "customer_name", label: { ar: "العميل", en: "Customer" } },
    { key: "rating", label: { ar: "النجوم", en: "Rating" }, type: "number" },
    { key: "title", label: { ar: "العنوان", en: "Title" }, hideOnMobile: true },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "badge" },
    { key: "verified_purchase", label: { ar: "موثّق", en: "Verified" }, type: "boolean", hideOnMobile: true },
    { key: "helpful_count", label: { ar: "مفيد", en: "Helpful" }, type: "number", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["customer_name", "title", "body"] },
    { key: "status", type: "select", label: { ar: "الحالة", en: "Status" },
      options: [
        { value: "pending", label: { ar: "بانتظار", en: "Pending" } },
        { value: "approved", label: { ar: "مقبول", en: "Approved" } },
        { value: "rejected", label: { ar: "مرفوض", en: "Rejected" } },
        { value: "spam", label: { ar: "سبام", en: "Spam" } },
      ] },
  ],
  form: [
    {
      key: "product_id",
      label: { ar: "المنتج", en: "Product" },
      type: "lookup",
      required: true,
      lookup: productLookup,
    },
    { key: "customer_name", label: { ar: "اسم العميل", en: "Customer name" }, type: "text", required: true },
    { key: "rating", label: { ar: "النجوم (1-5)", en: "Rating (1-5)" }, type: "number", min: 1, max: 5, required: true },
    { key: "title", label: { ar: "العنوان", en: "Title" }, type: "text" },
    { key: "body", label: { ar: "النص", en: "Body" }, type: "textarea", rows: 4 },
    { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select",
      options: [
        { value: "pending", label: { ar: "بانتظار", en: "Pending" } },
        { value: "approved", label: { ar: "مقبول", en: "Approved" } },
        { value: "rejected", label: { ar: "مرفوض", en: "Rejected" } },
        { value: "spam", label: { ar: "سبام", en: "Spam" } },
      ], defaultValue: "pending" },
    { key: "verified_purchase", label: { ar: "شراء موثّق", en: "Verified purchase" }, type: "boolean", defaultValue: false },
    { key: "images", label: { ar: "الصور (روابط JSON)", en: "Images (JSON array)" }, type: "json", defaultValue: [] },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Site themes ─────────
export const siteThemesConfig: AdminPageConfig = {
  title: { ar: "ثيمات الموقع", en: "Site Themes" },
  description: { ar: "حِزَم الألوان والخطوط والمكوّنات", en: "Color packs, fonts and component tokens" },
  table: "site_themes",
  orderBy: { column: "updated_at", ascending: false },
  columns: [
    { key: "name", label: { ar: "الاسم", en: "Name" } },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
    { key: "is_draft", label: { ar: "مسودة", en: "Draft" }, type: "boolean", hideOnMobile: true },
    { key: "updated_at", label: { ar: "آخر تحديث", en: "Updated" }, type: "datetime", hideOnMobile: true },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", required: true },
    { key: "colors", label: { ar: "الألوان", en: "Colors" }, type: "json" },
    { key: "fonts", label: { ar: "الخطوط", en: "Fonts" }, type: "json" },
    { key: "branding", label: { ar: "الهوية", en: "Branding" }, type: "json" },
    { key: "components", label: { ar: "المكوّنات", en: "Components" }, type: "json" },
    { key: "tokens", label: { ar: "الرموز", en: "Tokens" }, type: "json" },
    { key: "is_draft", label: { ar: "مسودة", en: "Draft" }, type: "boolean", defaultValue: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: false },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Shipping zones ─────────
export const shippingZonesConfig: AdminPageConfig = {
  title: { ar: "مناطق الشحن", en: "Shipping Zones" },
  table: "shipping_zones",
  orderBy: { column: "name_ar", ascending: true },
  columns: [
    { key: "name_ar", label: { ar: "الاسم (عربي)", en: "Name (AR)" } },
    { key: "name_en", label: { ar: "الاسم (إنجليزي)", en: "Name (EN)" }, hideOnMobile: true },
    { key: "country_code", label: { ar: "الدولة", en: "Country" }, type: "badge" },
    { key: "delivery_days_min", label: { ar: "أيام (من)", en: "Days min" }, type: "number", hideOnMobile: true },
    { key: "delivery_days_max", label: { ar: "أيام (إلى)", en: "Days max" }, type: "number", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name_ar", "name_en", "country_code"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    {
      key: "carrier_id",
      label: { ar: "شركة الشحن", en: "Shipping carrier" },
      type: "lookup",
      lookup: carrierLookup,
    },
    { key: "name_ar", label: { ar: "الاسم (عربي)", en: "Name (AR)" }, type: "text", required: true },
    { key: "name_en", label: { ar: "الاسم (إنجليزي)", en: "Name (EN)" }, type: "text" },
    { key: "country_code", label: { ar: "رمز الدولة", en: "Country code" }, type: "text", defaultValue: "SA", maxLength: 2 },
    { key: "cities", label: { ar: "المدن", en: "Cities" }, type: "json",
      helpText: { ar: 'مثال: ["الرياض","جدة"]', en: 'e.g. ["Riyadh","Jeddah"]' } },
    { key: "delivery_days_min", label: { ar: "أقل عدد أيام", en: "Min days" }, type: "number", defaultValue: 1 },
    { key: "delivery_days_max", label: { ar: "أعلى عدد أيام", en: "Max days" }, type: "number", defaultValue: 5 },
    { key: "is_active", label: { ar: "نشطة", en: "Active" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Shipping rates ─────────
export const shippingRatesConfig: AdminPageConfig = {
  title: { ar: "أسعار الشحن", en: "Shipping Rates" },
  table: "shipping_rates",
  orderBy: { column: "priority", ascending: true },
  columns: [
    { key: "zone_id", label: { ar: "المنطقة", en: "Zone" }, hideOnMobile: true },
    { key: "carrier_id", label: { ar: "الشركة", en: "Carrier" }, hideOnMobile: true },
    { key: "rate_type", label: { ar: "النوع", en: "Type" }, type: "badge" },
    { key: "base_fee", label: { ar: "الأساس", en: "Base" }, type: "currency" },
    { key: "per_kg_fee", label: { ar: "/كجم", en: "/kg" }, type: "currency", hideOnMobile: true },
    { key: "free_shipping_threshold", label: { ar: "شحن مجاني فوق", en: "Free over" }, type: "currency", hideOnMobile: true },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "number", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "rate_type", type: "select", label: { ar: "النوع", en: "Type" },
      options: [
        { value: "flat", label: { ar: "ثابت", en: "Flat" } },
        { value: "weight", label: { ar: "بالوزن", en: "Weight" } },
        { value: "value", label: { ar: "بالقيمة", en: "Value" } },
      ] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    {
      key: "zone_id",
      label: { ar: "منطقة الشحن", en: "Shipping zone" },
      type: "lookup",
      required: true,
      lookup: zoneLookup,
    },
    {
      key: "carrier_id",
      label: { ar: "شركة الشحن", en: "Shipping carrier" },
      type: "lookup",
      lookup: carrierLookup,
    },
    { key: "rate_type", label: { ar: "نوع التسعير", en: "Rate type" }, type: "select",
      options: [
        { value: "flat", label: { ar: "ثابت", en: "Flat" } },
        { value: "weight", label: { ar: "بالوزن", en: "By weight" } },
        { value: "value", label: { ar: "بقيمة الطلب", en: "By value" } },
      ], defaultValue: "flat" },
    { key: "base_fee", label: { ar: "الرسوم الأساسية", en: "Base fee" }, type: "number", min: 0, step: 0.01, defaultValue: 0 },
    { key: "per_kg_fee", label: { ar: "رسوم لكل كجم", en: "Per-kg fee" }, type: "number", min: 0, step: 0.01, defaultValue: 0 },
    { key: "min_weight_kg", label: { ar: "أدنى وزن (كجم)", en: "Min weight (kg)" }, type: "number", min: 0, step: 0.01 },
    { key: "max_weight_kg", label: { ar: "أعلى وزن (كجم)", en: "Max weight (kg)" }, type: "number", min: 0, step: 0.01 },
    { key: "min_order_value", label: { ar: "أدنى قيمة طلب", en: "Min order value" }, type: "number", min: 0, step: 0.01 },
    { key: "max_order_value", label: { ar: "أعلى قيمة طلب", en: "Max order value" }, type: "number", min: 0, step: 0.01 },
    { key: "free_shipping_threshold", label: { ar: "شحن مجاني فوق", en: "Free shipping threshold" }, type: "number", min: 0, step: 0.01 },
    { key: "cod_extra_fee", label: { ar: "رسوم COD إضافية", en: "COD extra fee" }, type: "number", min: 0, step: 0.01, defaultValue: 0 },
    { key: "priority", label: { ar: "الأولوية", en: "Priority" }, type: "number", defaultValue: 100 },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};

// ───────── Shipping carriers (extend existing) ─────────
export const shippingCarriersConfig: AdminPageConfig = {
  title: { ar: "شركات الشحن", en: "Shipping Carriers" },
  table: "shipping_carriers",
  orderBy: { column: "display_order", ascending: true },
  columns: [
    { key: "logo_url", label: { ar: "الشعار", en: "Logo" }, type: "image", width: "w-16" },
    { key: "name_ar", label: { ar: "الاسم", en: "Name" } },
    { key: "code", label: { ar: "الكود", en: "Code" }, hideOnMobile: true },
    { key: "carrier_type", label: { ar: "النوع", en: "Type" }, type: "badge", hideOnMobile: true },
    { key: "supports_cod", label: { ar: "COD", en: "COD" }, type: "boolean", hideOnMobile: true },
    { key: "supports_tracking", label: { ar: "تتبع", en: "Track" }, type: "boolean", hideOnMobile: true },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean" },
  ],
  filters: [
    { key: "search", type: "search", columns: ["name_ar", "name_en", "code"] },
    { key: "is_active", type: "select", label: { ar: "الحالة", en: "Status" }, options: yesNo },
  ],
  form: [
    { key: "code", label: { ar: "الكود", en: "Code" }, type: "text", required: true, maxLength: 32 },
    { key: "name_ar", label: { ar: "الاسم (عربي)", en: "Name (AR)" }, type: "text", required: true },
    { key: "name_en", label: { ar: "الاسم (إنجليزي)", en: "Name (EN)" }, type: "text" },
    { key: "carrier_type", label: { ar: "النوع", en: "Type" }, type: "select",
      options: [
        { value: "domestic", label: { ar: "محلي", en: "Domestic" } },
        { value: "international", label: { ar: "دولي", en: "International" } },
        { value: "express", label: { ar: "سريع", en: "Express" } },
      ], defaultValue: "domestic" },
    { key: "logo_url", label: { ar: "الشعار", en: "Logo" }, type: "image", bucket: "category-media", folder: "carriers" },
    { key: "api_endpoint", label: { ar: "API Endpoint", en: "API Endpoint" }, type: "url" },
    { key: "webhook_secret_name", label: { ar: "اسم سر الويبهوك", en: "Webhook secret name" }, type: "text" },
    { key: "default_delivery_days_min", label: { ar: "أقل أيام افتراضياً", en: "Default min days" }, type: "number", defaultValue: 1 },
    { key: "default_delivery_days_max", label: { ar: "أعلى أيام افتراضياً", en: "Default max days" }, type: "number", defaultValue: 5 },
    { key: "supports_cod", label: { ar: "يدعم COD", en: "Supports COD" }, type: "boolean", defaultValue: true },
    { key: "supports_international", label: { ar: "يدعم الدولي", en: "Supports intl." }, type: "boolean" },
    { key: "supports_tracking", label: { ar: "يدعم التتبع", en: "Supports tracking" }, type: "boolean", defaultValue: true },
    { key: "supports_webhook", label: { ar: "يدعم Webhook", en: "Supports webhook" }, type: "boolean" },
    { key: "display_order", label: { ar: "الترتيب", en: "Display order" }, type: "number", defaultValue: 0 },
    { key: "is_active", label: { ar: "نشط", en: "Active" }, type: "boolean", defaultValue: true },
  ],
  actions: { create: true, edit: true, delete: true, export: true },
};
