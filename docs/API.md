# API & Webhooks

نظام كامل: واجهة داخلية (Server Functions) للتطبيق + REST API خارجي للشركاء + نظام Webhooks مع توقيع HMAC وretries.

## بنية API

### داخلي (`src/server/api.functions.ts`)
يستخدم `createServerFn` + `requireSupabaseAuth`. يطبّق RLS كصلاحيات المستخدم.

| Function          | الغرض                            |
| ----------------- | -------------------------------- |
| `listProducts`    | قائمة منتجات مع pagination/بحث  |
| `listOrders`      | قائمة طلبات مع فلترة             |
| `listCustomers`   | قائمة العملاء (RLS)              |
| `updateInventory` | تعديل مخزون منتج                 |
| `reportSummary`   | KPIs آخر 30 يومًا                |

### خارجي — REST API v1 (`/api/v1/*`)
Bearer token عبر `Authorization: Bearer mn_live_...`. يطبق scopes ويسجّل كل طلب في `api_request_logs`.

| Endpoint                       | Method | Scope                 |
| ------------------------------ | ------ | --------------------- |
| `/api/v1/products`             | GET    | `products:read`       |
| `/api/v1/orders`               | GET    | `orders:read`         |
| `/api/v1/inventory`            | POST   | `inventory:write`     |

استجابة موحّدة:
```json
{ "ok": true, "data": { "items": [...], "page": 1, "page_size": 20, "total": 100 } }
```
أو خطأ:
```json
{ "ok": false, "error": { "code": "unauthorized", "message": "..." } }
```

## Webhooks

### الأحداث المدعومة
- `order.created`, `order.paid`, `order.cancelled`, `order.shipped`, `order.delivered`
- `payment.succeeded`, `payment.failed`
- `shipment.created`, `shipment.updated`
- `inventory.low`
- `customer.created`
- `cart.abandoned`

### بنية الـ Payload
```json
{
  "event": "order.paid",
  "id": "evt_<uuid>",
  "created_at": "2026-04-29T12:34:56.000Z",
  "data": {
    "order_id": "<uuid>",
    "order_number": "ORD-2026-00123",
    "status": "processing",
    "payment_status": "paid",
    "total": 245.00,
    "currency": "SAR",
    "customer_id": "<uuid>"
  }
}
```

### التوقيع الأمني (HMAC-SHA256)
كل طلب يحمل header:
```
X-Webhook-Signature: t=<unix_ts>,v1=<hex_signature>
X-Webhook-Event: order.paid
X-Webhook-Delivery: <delivery_uuid>
```
التحقق في طرفك:
```ts
import { createHmac, timingSafeEqual } from "crypto";
const [, ts] = header.split(",")[0].split("=");
const [, sig] = header.split(",")[1].split("=");
const expected = createHmac("sha256", SECRET)
  .update(`${ts}.${rawBody}`).digest("hex");
const valid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
// ارفض إذا |now - ts| > 5 دقائق
```

### Retry Policy
| المحاولة | التأخير    |
| -------- | ---------- |
| 1        | فورًا      |
| 2        | بعد 1 دقيقة|
| 3        | بعد 5 دقائق|
| 4        | بعد 30 دقيقة|
| 5        | بعد ساعتين |
| (max)    | بعد 12 ساعة|

بعد 5 محاولات فاشلة → status = `dead` (لن يُعاد).
طرفك يجب أن يرجع 2xx ليُعتبر ناجحًا، وأي 4xx/5xx أو timeout (10s) يُحفّز retry.

### Logs & Failure Handling
- جدول `webhook_deliveries` يحفظ كل محاولة (status, http_status, response_body, error_message, attempt, next_retry_at).
- صفحة `/admin/webhooks` تعرض السجل وتسمح بإيقاف/تشغيل endpoints.
- عند فشل متتالي ≥ 10، يُنصح بإيقاف الـ endpoint يدويًا وفحصه.

### Cron للـ retries
نقطة `/api/public/webhooks-retry` (تطلب header `x-cron-key: $WEBHOOK_CRON_SECRET`):
- استدعها كل دقيقة من pg_cron أو scheduler خارجي
- تعالج حتى 100 retry بكل تشغيل

## API Keys
- تُنشأ من قاعدة البيانات (مستقبلًا: واجهة UI). الصيغة: `mn_live_<32 byte base64url>`.
- يُحفظ فقط `sha256(key)` في الجدول. المفتاح الكامل يُعرض **مرة واحدة** عند الإنشاء.
- لكل مفتاح: `scopes` (مثل `products:read`, `*` للجميع)، `rate_limit_per_minute`، `expires_at`.

## Security checklist
- ✅ HMAC-SHA256 timestamped signing (يحمي من replay)
- ✅ تسامح ±5 دقائق على timestamp
- ✅ Constant-time signature compare
- ✅ Bearer token مع sha256 hash في DB
- ✅ Scope-based authorization
- ✅ Rate-limit hint per key
- ✅ كل طلب مُسجّل (api_request_logs) مع IP وUser-Agent
