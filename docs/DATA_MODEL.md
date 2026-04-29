# نموذج البيانات (Data Model / ERD)

وثيقة مرجعية للكيانات الأساسية في النظام، حقولها، علاقاتها، حالاتها، وملاحظاتها الأمنية والتشغيلية.

> الاصطلاحات: PK = Primary Key, FK = Foreign Key, UQ = Unique. كل جدول لديه `id uuid`، `created_at`، `updated_at` افتراضياً (لا تُكرَّر أدناه).

---

## 1. Users (auth.users — مُدارة من Lovable Cloud)

**الحقول المهمة:** `id`, `email` (UQ), `phone`, `encrypted_password`, `email_confirmed_at`, `last_sign_in_at`, `raw_user_meta_data`, `banned_until`.

**العلاقات:** 1—1 مع `profiles`، 1—N مع `user_roles`، 1—N مع `orders`، 1—N مع `addresses`.

**الحالات:** `pending_confirmation` → `active` → `banned` / `deleted`.

**ملاحظات أمنية:**
- لا تُعدّل مباشرة من الواجهة؛ كل عملية عبر `supabase.auth`.
- لا تُخزّن أدوار أو صلاحيات هنا (تجنّب privilege escalation).
- استخدم `account_lockouts` و`failed_login_attempts` لمنع brute-force.

---

## 2. Roles (`app_role` enum + `user_roles`)

**القيم:** `super_admin`, `admin`, `manager`, `staff`, `support`, `customer`.

**جدول `user_roles`:** `user_id` (FK auth.users), `role` (app_role), UQ(user_id, role).

**العلاقات:** N—N منطقياً بين المستخدمين والأدوار.

**ملاحظات أمنية:**
- **مطلق:** لا تخزّن الدور في `profiles`.
- التحقق دائماً عبر `has_role(uid, role)` (SECURITY DEFINER) لتجنّب recursive RLS.

---

## 3. Permissions (`role_permissions`)

**الحقول:** `role` (app_role), `permission` text (مثل `customers.view_pii`, `orders.refund`, `*`).

**العلاقات:** N—N مع الأدوار.

**ملاحظات:** الدالة `has_permission(uid, perm)` ترجع true لـ super_admin/admin أو لـ wildcard `*`. أضف صلاحيات جديدة هنا فقط — لا hardcoding في الواجهة.

---

## 4. Customers (`profiles`)

**الحقول:** `user_id` (FK UQ), `email`, `full_name`, `phone`, `birth_date`, `gender`, `marketing_consent` bool, `marketing_consent_at`, `loyalty_points`, `tags` text[], `language`, `default_address_id`.

**العلاقات:** 1—1 مع users، 1—N مع addresses/orders/carts/reviews/tickets.

**الحالات:** `active`, `disabled`, `deletion_requested`, `deleted` (soft).

**ملاحظات أمنية:**
- استخدم `get_profile_safe()` و`mask_email()`/`mask_phone()` للموظفين بدون صلاحية `customers.view_pii`.
- احترم `marketing_consent` قبل أي حملة (انظر سياسة الخصوصية).

---

## 5. Addresses

**الحقول:** `user_id` (FK), `label` (home/work), `recipient_name`, `phone`, `country`, `city`, `district`, `street`, `building`, `postal_code`, `lat`, `lng`, `is_default`, `notes`.

**العلاقات:** N—1 مع profiles؛ مرجع في `orders.shipping_address_snapshot` (snapshot JSONB).

**الحالات:** `active`, `archived`.

**ملاحظات:** خزّن **snapshot** للعنوان داخل الطلب لمنع تغيّره لاحقاً. الإحداثيات اختيارية — تحقّق من نطاق التوصيل قبل الإنشاء.

---

## 6. Products

**الحقول:** `sku` (UQ), `slug` (UQ), `name_ar`, `name_en`, `description_ar/en`, `short_description_ar/en`, `brand`, `price`, `compare_at_price`, `cost`, `currency`, `image_url`, `images` text[], `is_active`, `stock`, `reserved_stock`, `low_stock_threshold`, `views_count`, `sales_count`, `search_vector` tsvector, `seo_title`, `seo_description`.

**العلاقات:** N—N مع categories (عبر `product_categories`)، 1—N مع variants/inventory/reviews.

**الحالات:** `draft`, `active`, `out_of_stock`, `archived`, `deleted`.

**ملاحظات:** لا تحذف نهائياً — استخدم `is_active=false` لحفظ تاريخ الطلبات. السعر الفعلي يُخزَّن snapshot في `order_items`.

---

## 7. ProductVariants

**الحقول:** `product_id` (FK), `sku` (UQ), `option_values` jsonb (مثال: `{"color":"أحمر","size":"M"}`), `price_delta`, `barcode`, `stock`, `image_url`, `is_active`.

**العلاقات:** N—1 مع products، 1—N مع `inventory_items`.

**الحالات:** `active`, `out_of_stock`, `archived`.

**ملاحظات:** المخزون الفعلي على مستوى المتغيّر، وليس المنتج، إذا كان للمنتج متغيّرات.

---

## 8. Categories

**الحقول:** `slug` (UQ), `name_ar`, `name_en`, `parent_id` (FK self), `image_url`, `position`, `is_active`, `seo_title`, `seo_description`.

**العلاقات:** شجرة (self-referencing)، N—N مع products.

**الحالات:** `active`, `hidden`.

**ملاحظات:** احذر العمق المفرط (>3 مستويات يُربك التنقل وSEO).

---

## 9. Inventory (`inventory_items`)

**الحقول:** `warehouse_id` (FK), `product_id`/`variant_id` (FK), `on_hand` int, `reserved` int, `available` (computed = on_hand - reserved), `reorder_point`, `last_counted_at`.

**العلاقات:** N—1 مع warehouses ومع products/variants.

**ملاحظات:** كل تغيّر يجب أن يُكتب في `inventory_movements` (in/out/reserve/release/adjust) للتتبع. trigger `inventory.low` عند تجاوز `reorder_point`.

---

## 10. Warehouses

**الحقول:** `code` (UQ), `name`, `address`, `city`, `lat`, `lng`, `is_active`, `priority` (لتحديد أولوية الشحن).

**العلاقات:** 1—N مع inventory_items وshipments.

**الحالات:** `active`, `inactive`.

---

## 11. Carts

**الحقول:** `user_id` (FK, nullable للضيوف), `session_id` (للضيوف), `currency`, `coupon_code`, `subtotal`, `discount`, `total`, `expires_at`, `abandoned_notified_at`.

**العلاقات:** 1—N مع cart_items، تُحوَّل إلى order عند Checkout.

**الحالات:** `active`, `abandoned`, `converted`, `expired`.

**ملاحظات:** trigger `cart.abandoned` بعد X ساعة بدون نشاط. RLS: المالك فقط أو session_id مطابق.

---

## 12. CartItems

**الحقول:** `cart_id` (FK), `product_id`/`variant_id`, `qty`, `unit_price` (snapshot وقت الإضافة), `meta` jsonb.

**العلاقات:** N—1 مع cart ومع products/variants.

**ملاحظات:** أعد التحقق من السعر/المخزون عند Checkout — لا تثق بـ snapshot القديم.

---

## 13. Orders

**الحقول:** `order_number` (UQ مقروء), `customer_id`, `status`, `payment_status`, `fulfillment_status`, `currency`, `subtotal`, `discount`, `shipping_cost`, `tax`, `total`, `coupon_code`, `shipping_address_snapshot` jsonb, `billing_address_snapshot` jsonb, `notes`, `internal_notes` jsonb[], `expires_at` (للحجز), `stock_reserved` bool, `cancelled_at`, `cancellation_reason`.

**العلاقات:** N—1 مع customer، 1—N مع order_items/payments/shipments/refunds/returns.

**الحالات:**
- `status`: pending → confirmed → processing → shipped → delivered → completed | cancelled | returned
- `payment_status`: unpaid → pending_review → paid | failed | refunded | partially_refunded | expired

**ملاحظات أمنية:**
- العميل يرى طلباته فقط (RLS عبر customer_id).
- لا تسمح بتعديل المبالغ من الواجهة — كلها server-side.
- `auto_cancel_expired_orders()` يحرّر المخزون المحجوز.

---

## 14. OrderItems

**الحقول:** `order_id` (FK), `product_id`/`variant_id` (nullable للسلامة عند الحذف), `sku_snapshot`, `name_snapshot`, `image_snapshot`, `qty`, `unit_price`, `discount`, `tax`, `total`.

**ملاحظات:** Snapshots كاملة — لا تعتمد على الـ FK لعرض تفاصيل الطلب القديم.

---

## 15. Payments

**الحقول:** `order_id` (FK), `provider` (mada/visa/applepay/stcpay/cod/bank_transfer), `provider_ref` (UQ), `amount`, `currency`, `status`, `method_meta` jsonb (آخر 4 أرقام فقط)، `failure_code`, `failure_message`, `paid_at`, `refunded_amount`.

**الحالات:** `initiated` → `authorized` → `captured` (paid) | `failed` | `cancelled` | `refunded` | `partially_refunded`.

**ملاحظات أمنية:**
- **لا تُخزَّن** أرقام البطاقات أو CVV أبداً — Tokenization من المزوّد فقط.
- تحقّق من توقيع webhook (`PAYMENT_WEBHOOK_SECRET`) قبل تحديث الحالة.

---

## 16. Shipments

**الحقول:** `order_id` (FK), `warehouse_id`, `carrier` (smsa/aramex/spl…), `tracking_number` (UQ), `tracking_url`, `status`, `estimated_delivery_at`, `delivered_at`, `weight`, `dimensions` jsonb, `cost`, `label_url`, `failure_reason`.

**الحالات:** `pending` → `created` → `picked_up` → `in_transit` → `out_for_delivery` → `delivered` | `failed` | `returned`.

**ملاحظات:** webhook events: `shipment.created`, `shipment.updated`. تخزّن آخر 50 update في `shipment_events`.

---

## 17. Refunds

**الحقول:** `order_id`, `payment_id` (FK), `amount`, `reason`, `status`, `requested_by`, `approved_by`, `processed_at`, `provider_ref`.

**الحالات:** `requested` → `approved` → `processing` → `completed` | `rejected` | `failed`.

**ملاحظات:** لا تتجاوز قيمة الدفع الأصلي. كل عملية تُسجَّل في `audit_logs` تلقائياً.

---

## 18. Returns

**الحقول:** `order_id`, `rma_number` (UQ), `reason`, `status`, `items` jsonb (item_id, qty, condition), `photos` text[] (bucket: return-photos), `pickup_address` jsonb, `inspector_notes`, `restock_decision`.

**الحالات:** `requested` → `approved` → `pickup_scheduled` → `received` → `inspected` → `completed` | `rejected`.

**ملاحظات:** صور الإرجاع في bucket public للوصول السريع للمفتش.

---

## 19. Coupons

**الحقول:** `code` (UQ ci), `type` (percent/fixed/free_shipping), `value`, `min_order_amount`, `max_discount`, `usage_limit`, `usage_per_customer`, `used_count`, `starts_at`, `expires_at`, `is_active`, `applies_to` jsonb (categories/products/all), `customer_segments` text[].

**الحالات:** `scheduled`, `active`, `expired`, `disabled`, `exhausted`.

**ملاحظات:** التحقق server-side فقط. سجّل كل استخدام في `coupon_redemptions(customer_id, order_id, coupon_id)` لمنع التجاوز.

---

## 20. Notifications

**الحقول:** `user_id`, `channel` (email/sms/whatsapp/push/in_app), `template_key`, `payload` jsonb, `status`, `provider_ref`, `error`, `sent_at`, `read_at`.

**الحالات:** `queued` → `sending` → `sent` → `delivered` | `failed` | `bounced`.

**ملاحظات:** احترم `marketing_consent`. سجّل failures مع كود واضح للإعادة (انظر ERRORS.md).

---

## 21. NotificationTemplates

**الحقول:** `key` (UQ), `channel`, `language`, `subject`, `body` (Liquid/Handlebars), `variables` jsonb (وصف المتغيرات), `is_active`, `category` (transactional/marketing).

**ملاحظات:** Marketing templates لا تُرسَل إلا للموافقين. Transactional ترسل دائماً.

---

## 22. Reviews

**الحقول:** `product_id` (FK), `customer_id` (FK), `order_id` (للتحقق من الشراء), `rating` 1-5, `title`, `body`, `images` text[], `status` (pending/approved/rejected), `verified_purchase` bool, `helpful_count`.

**ملاحظات:** Moderation قبل النشر. UQ(product_id, customer_id, order_id) لمنع التكرار.

---

## 23. SupportTickets

**الحقول:** `ticket_number` (UQ), `customer_id`, `subject`, `category`, `priority`, `status`, `assigned_to`, `last_reply_at`, `last_reply_by`, `tags`, `related_order_id`.

**جدول `ticket_messages`:** `ticket_id`, `direction` (customer/staff), `body`, `attachments`, `is_internal_note` bool.

**الحالات:** `new` → `waiting_admin` → `waiting_customer` → `resolved` → `closed` | `reopened`.

**ملاحظات:** Internal notes لا تظهر للعميل أبداً (RLS صارم).

---

## 24. AuditLogs

**الحقول:** `actor_id`, `actor_email`, `action`, `entity`, `entity_id`, `old_data` jsonb, `new_data` jsonb, `metadata` (changed_fields), `ip_address`, `user_agent`.

**ملاحظات أمنية:**
- **Immutable** — trigger `prevent_audit_modification` يمنع UPDATE/DELETE.
- يُكتَب تلقائياً عبر `audit_row_change` على الجداول الحساسة.
- قراءة لـ admin/super_admin فقط.

---

## 25. Integrations

**الحقول:** `provider` (mada/tap/smsa/twilio/meta…), `category` (payment/shipping/sms/whatsapp/analytics), `config` jsonb, `credentials_secret_name` (مرجع لـ Lovable Secrets)، `is_active`, `last_health_check_at`, `last_error`.

**ملاحظات أمنية:** **لا تُخزَّن المفاتيح في DB** — فقط اسم الـ secret. القيم الفعلية في Lovable Cloud Secrets.

---

## 26. Reports

**الحقول:** `key`, `name`, `type` (sales/inventory/customers/marketing), `params` jsonb, `schedule` (cron), `last_run_at`, `last_result_url`, `recipients` text[], `format` (csv/xlsx/pdf).

**ملاحظات:** التنفيذ في edge function، النتائج في storage مع expiring URLs.

---

## 27. CMSPages

**الحقول:** `slug` (UQ), `title_ar/en`, `content_ar/en` (rich/json blocks), `template`, `is_published`, `published_at`, `seo_title`, `seo_description`, `og_image`, `redirect_to` (للـ 301).

**الحالات:** `draft`, `published`, `scheduled`, `archived`.

**ملاحظات:** صفحات هبوط الحملات تستخدم نفس الجدول مع `template='landing'`.

---

## 28. ThemeSettings

**الحقول:** `key` (UQ singleton), `colors` jsonb (primary/secondary/accent/bg)، `fonts` jsonb, `logo_url`, `favicon_url`, `social_links` jsonb, `header_config` jsonb, `footer_config` jsonb, `homepage_blocks` jsonb[], `mode` (light/dark/auto).

**ملاحظات:** سجّل واحد فقط (id=true). تعديل بصلاحية `theme.edit`.

---

## مخطط العلاقات (مرجعي)

```
auth.users 1—1 profiles 1—N addresses
auth.users 1—N user_roles N—1 app_role 1—N role_permissions

profiles 1—N orders 1—N order_items N—1 products 1—N variants
                  1—N payments
                  1—N shipments N—1 warehouses
                  1—N refunds, returns

profiles 1—N carts 1—N cart_items
profiles 1—N reviews N—1 products
profiles 1—N support_tickets 1—N ticket_messages

products N—N categories
warehouses 1—N inventory_items N—1 products/variants

coupons 1—N coupon_redemptions N—1 orders
notifications N—1 notification_templates

audit_logs (immutable) — يلتقط من orders/products/profiles…
integrations — مرجع لـ secrets
cms_pages, theme_settings — مستقلة
```

---

## مبادئ مشتركة

1. **Snapshots في الطلبات** — أسعار/أسماء/عناوين لا تُقرأ من الجدول الأصلي بعد الإنشاء.
2. **Soft delete** للمنتجات والعملاء — `deleted_at` بدل DELETE.
3. **RLS على كل جدول** — العميل يرى بياناته فقط، الموظف حسب صلاحيته.
4. **Triggers للـ webhooks** — انظر `orders_emit_events`, `products_emit_low_stock`.
5. **PII Masking** — `mask_email`/`mask_phone` للموظفين بدون `customers.view_pii`.
6. **Immutable audit** — لا تعديل ولا حذف.
7. **Secrets خارج DB** — مفاتيح المزوّدين في Lovable Secrets فقط.
