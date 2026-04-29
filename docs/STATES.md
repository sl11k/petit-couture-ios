# Screen States Guide

كل شاشة في النظام يجب أن تتعامل مع 13 حالة قياسية. تم توحيدها في
`src/components/states/StateViews.tsx`.

## الحالات المدعومة

| الحالة         | المكوّن                                  | متى تُستخدم                         |
| -------------- | ---------------------------------------- | ----------------------------------- |
| Default        | محتوى الشاشة العادي                      | البيانات متوفرة وكافية               |
| Loading        | `<LoadingState variant="list/grid/...">` | أثناء جلب البيانات                  |
| Empty          | `<EmptyState>` / `<NoSearchResults>`     | لا توجد بيانات لعرضها                |
| Error          | `<ErrorState variant="block/inline/page">` | فشل الجلب أو العملية                |
| Success        | `<SuccessState>`                          | بعد إكمال إجراء                     |
| Disabled       | `disabled` prop على الأزرار/الحقول        | منع تفاعل مؤقت                      |
| Hover / Active | Tailwind `hover:` / `active:`             | تغذية بصرية على التفاعل             |
| Mobile         | Mobile-first + `sm:`/`md:`                | كل المكوّنات تتجاوب افتراضيًا       |
| RTL            | `dir="rtl"` + `me-` `ms-` logical props   | الواجهة العربية                     |
| Long Text      | `<Truncate lines={1\|2\|3}>`              | عرض نصوص قد تطول                    |
| بيانات كثيرة   | Pagination / Infinite Scroll / virtualization | جداول وقوائم ضخمة               |
| بيانات قليلة   | `<EmptyState compact>` أو رسالة سياقية   | عنصر واحد أو لا شيء                 |
| Offline        | `<ConnectivityBadge>` + `<OfflineState>`  | فقدان الاتصال                       |

## الاستخدام السريع

```tsx
import { StateBoundary } from "@/components/states/StateViews";

<StateBoundary
  loading={isLoading}
  error={error}
  isEmpty={items.length === 0}
  onRetry={refetch}
  loadingVariant="grid"
  emptyTitle="لا توجد منتجات"
  emptyAction={{ label: "إضافة", onClick: openCreate }}
>
  {/* المحتوى الافتراضي */}
</StateBoundary>;
```

## معاينة حية
صفحة `/admin/states` تعرض جميع الحالات مع أمثلة تفاعلية.

## قواعد عامة
- لا تخفِ المحتوى بدون رسالة — كل حالة فارغة يجب أن تشرح "لماذا" و"ماذا تفعل".
- كل خطأ يجب أن يوفّر زر إعادة محاولة عند الإمكان.
- استخدم `aria-busy`, `role="status"`, `role="alert"` المضمّنة في المكوّنات.
- النصوص الطويلة → استعمل `<Truncate>` أو `break-words`، لا تترك overflow.
- الأزرار التي تنفّذ طلبًا → اجعلها `disabled` أثناء التحميل لمنع النقر المزدوج.
