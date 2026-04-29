# كتالوج الأخطاء وسياسة المعالجة

نظام موحّد لمعالجة جميع حالات الخطأ في المتجر. لكل خطأ:
- **رسالة للعميل**: واضحة، ودودة، بدون مصطلحات تقنية، تطمئنه أن بياناته محفوظة.
- **رسالة للإدارة**: تفصيلية مع context كافٍ للتشخيص.
- **Log داخلي**: مكتوب في جدول `error_logs` مع stack/url/user agent.
- **إجراء مقترح**: ما يجب على النظام/المشغّل فعله.
- **حماية بيانات العميل**: لا تُمسح السلة ولا العنوان عند أي خطأ.

## الأكواد المُعرَّفة (`src/lib/errors.ts`)

| الكود | الفئة | الخطورة |
|---|---|---|
| `PAYMENT_FAILED` | payment | error |
| `PAYMENT_DOUBLE_CLICK` | payment | warning |
| `STOCK_OUT_DURING_CHECKOUT` | stock | error |
| `PRICE_CHANGED_DURING_CHECKOUT` | checkout | warning |
| `COUPON_INVALID` | discount | info |
| `COUPON_EXPIRED` | discount | info |
| `SHIPPING_PROVIDER_DOWN` | shipping | error |
| `ADDRESS_OUT_OF_RANGE` | location | warning |
| `PRODUCT_NOT_AVAILABLE_IN_CITY` | stock | warning |
| `GEOLOCATION_FAILED` | location | info |
| `SMS_SEND_FAILED` | messaging | warning |
| `WHATSAPP_SEND_FAILED` | messaging | warning |
| `SHIPMENT_CREATE_FAILED` | shipping | error |
| `WEBHOOK_FAILED` | webhook | error |
| `STOCK_INCONSISTENCY` | stock | critical |
| `NETWORK_OFFLINE` | network | warning |
| `SYSTEM_ERROR` | system | error |

## كيفية الاستخدام

```ts
import { logError, withIdempotency, makeIdempotencyKey } from "@/lib/errors";
import { ErrorDisplay } from "@/components/ErrorDisplay";

// تسجيل خطأ
await logError("PAYMENT_FAILED", {
  context: { gateway: "stripe", reason: "card_declined" },
  userId, orderId,
});

// عرض رسالة للعميل
<ErrorDisplay code="STOCK_OUT_DURING_CHECKOUT" onRetry={...} context={{ itemName: "..." }} />

// منع الضغط المزدوج على زر الدفع
const key = makeIdempotencyKey("payment", orderId);
const { result, replayed } = await withIdempotency(key, "payment", async () => {
  return await chargeCard(...);
});
```

## الميزات المدمجة

- **GlobalErrorBoundary** في `__root.tsx`: يمسك أي استثناء غير مُعالَج ويعرض رسالة لطيفة.
- **OfflineBanner**: يظهر عند انقطاع الإنترنت ويطمئن العميل.
- **Offline buffer**: الأخطاء التي تحدث بدون اتصال تُحفظ في `localStorage` وتُرسل تلقائيًا عند العودة.
- **Idempotency keys**: جدول `idempotency_keys` يمنع تكرار الطلبات.
- **لوحة `/admin/errors`**: عرض، فلترة، وضع علامة "مُعالَج"، وكتالوج كامل لكل الأكواد.

## RLS

- أي شخص (حتى الضيف) يستطيع `INSERT` في `error_logs`.
- فقط الـ admin/manager/staff يستطيعون قراءتها.
- التعديل (وضع كـ مُعالَج) للـ admin/manager فقط.
