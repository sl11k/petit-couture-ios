# Mobile-First Design

تم بناء الموقع mobile-first. هذا الدليل يلخّص ما هو متاح وكيف يُستخدم.

## نظام التنقل

| العنصر               | المكوّن                               | الظهور           |
| -------------------- | ------------------------------------- | ---------------- |
| Header موبايل        | `<MobileHeader title showBack />`     | `< lg`           |
| Header ديسكتوب       | `<DesktopHeader />` (تلقائي في root)  | `≥ lg`           |
| Bottom Navigation    | `<MobileBottomNav />` (تلقائي في root)| `< lg`           |
| WhatsApp عائم        | `<WhatsAppButton />` (تلقائي في root) | الكل             |
| Apple Pay شارة/زر    | `<ApplePayBadge variant="button">`    | حسب الجهاز       |

`MobileBottomNav` يُخفى تلقائيًا في `/checkout`, `/login`, `/admin`, `/order-confirmation` لتقليل التشتيت.

## قواعد Mobile-First

1. **منطقة لمس ≥ 44×44px** — استخدم `h-11 w-11` كحد أدنى للأزرار الأيقونية، و`h-12` للأزرار الرئيسية.
2. **Safe area** — كل شيء ثابت أسفل الشاشة يستخدم `pb-[env(safe-area-inset-bottom)]`، وكل شيء أعلى الشاشة `pt-[env(safe-area-inset-top)]`.
3. **ابدأ من 360px** — صمّم لأصغر شاشة أولًا، ثم أضف `sm:` `md:` `lg:`.
4. **خط ≥ 14px** للقراءة (`text-sm` فأعلى) و≥ 16px للحقول لمنع zoom تلقائي على iOS.
5. **حقول input** — حدّد `inputMode` و`enterKeyHint` و`autoComplete` لتفعيل لوحات المفاتيح المناسبة:
   ```tsx
   <input inputMode="email" enterKeyHint="next" autoComplete="email" />
   <input inputMode="tel" enterKeyHint="done" autoComplete="tel" />
   <input inputMode="numeric" pattern="[0-9]*" autoComplete="cc-number" />
   ```
6. **لا Popups مدمّرة** — استخدم `<Toaster />` و`<Drawer />` بدلًا من `alert()` أو نوافذ منبثقة تغطي الشاشة. `CookieBanner` يظهر مرة واحدة فقط في الأسفل.
7. **عدم وجود حقول مزعجة** — اطلب الحد الأدنى في Checkout (اسم، هاتف، عنوان، طريقة دفع). كل ما عدا ذلك تأجيل لما بعد الطلب.

## Checkout مختصر للموبايل

- صفحة واحدة، 3 أقسام (Shipping → Payment → Review).
- تعبئة تلقائية للعنوان عبر `LocationPicker` (GPS).
- Apple Pay زر علوي بارز عند توفره.
- زر "إتمام الطلب" sticky في الأسفل، عرض كامل، `h-12`.

## صور محسّنة

- استخدم `<LazyImage>` (يحوي `loading="lazy"` + `decoding="async"` + skeleton).
- صور المنتجات: نسبة `aspect-[3/4]` ثابتة لمنع layout shift.
- مصادر متعددة (`srcset`) عند الإمكان: `360w`, `720w`, `1080w`.

## Product Cards على الموبايل

- شبكة `grid-cols-2` على الموبايل، `sm:grid-cols-3`, `lg:grid-cols-4`.
- صورة أعلى، اسم سطر واحد (`<Truncate lines={1}>`)، سعر، زر قلب.
- زر "إضافة للسلة" يظهر بحجم كامل عند الضغط بدلًا من hover.

## خرائط الموبايل

`LocationPicker` يستخدم Geolocation API. مفعّل OSM tiles بدقة عالية على الجوال، مع زر "موقعي الحالي" بحجم `h-12 w-full`.

## Apple Pay

```tsx
import { ApplePayBadge, useApplePayAvailable } from "@/components/ApplePayBadge";

const supports = useApplePayAvailable();
{supports && <ApplePayBadge variant="button" onClick={...} />}
```

## معاينة
- `/admin/states` — كل حالات الشاشة.
- صغّر نافذة المتصفح إلى 375px لمعاينة سلوك الموبايل، أو استعمل أيقونة الجهاز فوق المعاينة.
