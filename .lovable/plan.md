سأنفذ الطلب على 3 محاور. الحجم كبير جداً لذا سأقسمه:

## 1) حذف قسم "المواصفات / Specifications" من صفحة المنتج

- إزالة قسم Specifications كاملاً (العرض + أي حقول إدخال في الأدمن) من:
  - `src/routes/product.$slug.tsx` (قسم العرض للعميل)
  - `src/features/admin/configs/productDetail.config.tsx` (حقول التحرير للأدمن)
- الحقل يبقى موجوداً في قاعدة البيانات (لا حذف بيانات)، فقط نُخفيه ونعطّل تحريره.

## 2) صفحة "طلب استرجاع" للعميل

حالياً `account.returns.new.tsx` موجودة كملف لكن ناقصة الوظائف. سأبنيها بالكامل:

- اختيار الطلب من طلبات العميل المؤهلة (`isOrderEligibleForReturn`).
- اختيار المنتجات + الكميات + سبب الإرجاع + ملاحظات + رفع صور.
- إنشاء `return_requests` + `return_items`.
- بعد الإرسال: تشغيل حدث `return_requested` → واتساب للعميل + للأدمن + إشعار داخلي في `/admin/returns`.
- زر "طلب إرجاع" في صفحة تفاصيل الطلب في حساب العميل.

## 3) نظام أحداث الواتساب الشامل (+150 حدث)

البنية التحتية موجودة بالفعل: `notif_event_types`، `notification_rules`، `notification_templates`، مزود Wasender، دالة `notify()`.
سأقوم بـ:

### أ) Migration واحدة تُنشئ:

- كل event codes الناقصة في `notif_event_types` (سأدرج قائمة كاملة أدناه).
- قواعد افتراضية `notification_rules` مفعّلة لقناة `whatsapp` + `in_app` لكل حدث، لكلا الجمهورين (customer/admin) حيث ينطبق.
- قوالب `notification_templates` بالعربي والإنجليزي لكل (event × audience × whatsapp).

### ب) قائمة الأحداث (~160 حدث) موزّعة على المجالات:

**الطلبات (25)**: order_created, order_confirmed, order_paid, order_payment_failed, order_payment_pending, order_processing, order_packed, order_ready_pickup, order_shipped, order_out_for_delivery, order_delivered, order_delivery_failed, order_delivery_delayed, order_cancelled_by_customer, order_cancelled_by_admin, order_on_hold, order_edited, order_partial_shipment, order_note_added, order_invoice_ready, order_tax_invoice_ready, order_gift_wrapped, order_scheduled, order_reminder_pickup, order_completed.

**الدفع (15)**: payment_received, payment_partial, payment_authorized, payment_captured, payment_failed, payment_declined, payment_refund_initiated, payment_refunded, payment_partial_refund, payment_chargeback, payment_dispute, payment_method_expired, payment_retry, cod_confirmed, installment_due.

**الشحن (15)**: shipment_created, awb_generated, pickup_scheduled, picked_up, in_transit, arrived_hub, out_for_delivery, delivered, delivery_attempted, address_issue, returned_to_sender, lost_in_transit, damaged_in_transit, delivery_rescheduled, tracking_updated.

**المرتجعات (12)**: return_requested, return_under_review, return_approved, return_rejected, return_pickup_scheduled, return_received, return_inspection_passed, return_inspection_failed, return_refunding, return_refunded, return_closed, return_reminder.

**المخزون / المنتجات (12)**: product_back_in_stock, product_low_stock (admin), product_out_of_stock (admin), price_drop, new_product_launch, wishlist_item_on_sale, wishlist_back_in_stock, product_review_request, product_review_reply, product_question_asked, product_question_answered, variant_restock.

**الحساب / المصادقة (12)**: welcome, email_verified, phone_verified, password_reset_request, password_changed, email_changed, phone_changed, login_new_device, login_suspicious, account_locked, account_deleted, profile_incomplete.

**السلة / التحويل (8)**: cart_abandoned_1h, cart_abandoned_24h, cart_abandoned_72h, wishlist_reminder, browse_abandoned, checkout_abandoned, cart_price_changed, cart_item_unavailable.

**القسائم / الولاء (12)**: coupon_issued, coupon_expiring, coupon_expired, coupon_used, loyalty_points_earned, loyalty_points_expiring, loyalty_tier_up, loyalty_tier_down, loyalty_redeemed, referral_invited, referral_completed, referral_reward.

**الحملات / التسويق (6)**: promotion_started, flash_sale, seasonal_campaign, birthday_greeting, anniversary_greeting, winback.

**الدعم (8)**: support_ticket_created, support_ticket_replied, support_ticket_resolved, support_ticket_reopened, support_ticket_rated, support_ticket_escalated, support_new_message, support_auto_reply.

**تنبيهات الأدمن (25)**: admin_new_order, admin_high_value_order, admin_new_customer, admin_new_return, admin_new_ticket, admin_payment_failed, admin_refund_requested, admin_low_stock, admin_out_of_stock, admin_shipment_failed, admin_shipment_delayed, admin_review_new, admin_review_low_rating, admin_question_new, admin_abandoned_cart_high_value, admin_daily_summary, admin_weekly_summary, admin_login_suspicious, admin_error_spike, admin_webhook_failed, admin_integration_down, admin_backup_completed, admin_backup_failed, admin_disk_high, admin_traffic_spike.

**الفواتير / الضرائب (5)**: invoice_generated, invoice_sent, invoice_paid, invoice_overdue, credit_note_issued.

**خصوصية / GDPR (5)**: data_export_requested, data_export_ready, data_deletion_requested, data_deletion_completed, consent_updated.

المجموع: ~155 حدثاً.

### ج) نقاط الإطلاق (Triggers)

سأربط `notify()` بالمواقع الرئيسية التي تُنتج هذه الأحداث فعلاً الآن:

- إنشاء الطلب، تغيير الحالة، الدفع، الاسترداد، الشحن (webhooks)، المرتجعات، القسائم، تسجيل الدخول، إعادة تعيين كلمة المرور، السلة المتروكة، الدعم.
- بقية الأحداث تُسجَّل في الكتالوج مع القوالب لتكون جاهزة، ويمكن تشغيلها يدوياً من `/admin/notif-broadcast` أو ربطها لاحقاً.

### د) صفحة إدارة

- في `/admin/notif-templates` ستظهر كل القوالب الجديدة تلقائياً وقابلة للتحرير.

## التنفيذ على مرحلة واحدة

1.  حذف Specifications، (2) صفحة استرجاع العميل + ربط حدث `return_requested` بالواتساب، (3) Migration كتالوج +155 حدث + قوالب واتساب عربي/إنجليزي + قواعد افتراضية.
  ربط باقي نقاط الإطلاق (الشحن، الدفع، القسائم، الدعم...) واحدة واحدة حسب الأولوية.