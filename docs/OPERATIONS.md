# التشغيل والمراقبة (Operations & Observability)

وثيقة مرجعية لمتطلبات التشغيل، المراقبة، التنبيهات، النسخ الاحتياطي، والاسترجاع.

---

## 1. البيئات (Environments)

| البيئة | URL | الغرض | الوصول | البيانات |
|---|---|---|---|---|
| **Development** | localhost (loveable preview) | تطوير يومي | المطورون | بيانات وهمية (seed) |
| **Staging** | `project--{id}-dev.lovable.app` | UAT + اختبار قبل النشر | فريق المنتج + QA | snapshot أسبوعي من production مع PII مُقنَّعة |
| **Production** | `golden-boutique-ios.lovable.app` + الدومين المخصص | المستخدمون الفعليون | فريق التشغيل فقط | بيانات حقيقية |

**قواعد:**
- لا يُختبَر Production مباشرة — كل تغيير يمر عبر Staging.
- Secrets منفصلة لكل بيئة (Lovable Cloud Secrets per env).
- Cron jobs وWebhooks منفصلة (لا يرسل Staging إيميلات حقيقية للعملاء).

---

## 2. مراقبة حالة الموقع (Uptime)

| ما يُراقَب | الأداة | التكرار | عتبة التنبيه |
|---|---|---|---|
| الصفحة الرئيسية (200 OK) | UptimeRobot / BetterStack / Pingdom | كل دقيقة | 2 فشل متتالي |
| `/api/v1/products` (Status 200) | نفس | كل دقيقة | فشل 1 |
| `/checkout` (يحمّل) | نفس | كل 5 دقائق | فشل 1 |
| Database health (`cloud_status`) | cron داخلي | كل 5 دقائق | حالة ≠ ACTIVE_HEALTHY |
| Edge functions ping | cron `/api/public/health` | كل دقيقة | latency > 3s |

**SLA الهدف:** 99.9% توافر شهري (≈ 43 دقيقة downtime/شهر).

**Endpoint health (مطلوب):**
```ts
// src/routes/api/public/health.ts
GET /api/public/health → { status: "ok", db: "ok", time: ISO }
```

---

## 3. مراقبة فشل الدفع

**Triggers + Alerts:**
- كل `payment.failed` يُسجَّل في `payments` + `error_logs`.
- Dashboard `/admin/payments` يعرض معدل الفشل آخر 24س.
- **Alert** إذا تجاوز معدل الفشل 5% في آخر 30 دقيقة → Slack/Email للفريق التقني.
- **Alert فوري P0:** فشل webhook الدفع (توقيع غير صالح) — احتمال هجوم.

**Queries جاهزة:**
```sql
-- معدل الفشل آخر ساعة
SELECT
  count(*) FILTER (WHERE status = 'failed') * 100.0 / NULLIF(count(*),0) AS fail_rate
FROM payments WHERE created_at > now() - interval '1 hour';

-- أكثر أكواد الفشل
SELECT failure_code, count(*) FROM payments
WHERE status = 'failed' AND created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

---

## 4. مراقبة فشل الشحن

- `webhook_deliveries` يُسجِّل كل محاولة (success/fail + retry_count).
- **Alert P1** إذا فشل > 3 شحنات لنفس الناقل خلال ساعة → احتمال انقطاع API.
- Dashboard `/admin/shipments` يعرض الشحنات المعلَّقة > 24 ساعة.
- **Health check** يومي 9 صباحاً: ping على API كل ناقل (smsa/aramex/spl).

---

## 5. مراقبة فشل الرسائل (Email/SMS/WhatsApp)

**Email — `email_send_log`** (المصدر الموحَّد):
- Dashboard `/admin/emails` (محمي لـ admin فقط) مع:
  1. فلتر فترة (24س / 7أيام / 30 يوم / مخصص).
  2. فلتر `template_name`.
  3. فلتر `status` (sent/dlq/suppressed).
  4. بطاقات إحصائية (deduplicated by `message_id`).
  5. جدول السجلات مع pagination.
  6. **Alert** إذا تجاوز معدل DLQ 2% خلال ساعة.

**Deduplication ضرورية** — كل بريد له صفوف متعددة بنفس `message_id`، استخدم `DISTINCT ON (message_id) ... ORDER BY message_id, created_at DESC`.

**SMS / WhatsApp — `notifications`:**
- نفس النمط: dashboard `/admin/notifications` بفلاتر القناة والقالب والحالة.
- **Alert P0:** فشل > 10 رسائل OTP خلال 5 دقائق (مستخدمون لا يستطيعون الدخول).
- **Fallback تلقائي:** WhatsApp فشل → SMS → Email.

---

## 6. مراقبة الأخطاء (Error Monitoring)

**جدول `error_logs`** (سبق إنشاؤه في `ERRORS.md`):
- كل خطأ في الواجهة/الخادم يُكتب هنا تلقائياً.
- **Dashboard `/admin/errors`** يعرض:
  - أكثر 10 أخطاء تكراراً (آخر 24س / 7 أيام).
  - معدل الأخطاء بمرور الوقت (chart).
  - فلترة بـ severity / route / user_id.
  - تفاصيل كاملة (stack, request, user agent).

**Sentry / LogRocket (اختياري لكن موصى به):**
- Frontend errors + session replay.
- Source maps مرفوعة عند كل نشر.
- Release tagging يربط الأخطاء بالنسخة.

**عتبات التنبيه:**
| Severity | عتبة | إجراء |
|---|---|---|
| Critical | 1 خطأ | Slack فوري + SMS للمناوب |
| Error | 10/دقيقة | Slack فوري |
| Warning | 50/ساعة | Email يومي ملخّص |

---

## 7. مراقبة الأداء (Performance Monitoring)

### Real User Monitoring (RUM)
- Web Vitals (LCP, INP, CLS, TTFB) تُجمَع في `performance_metrics` جدول مخصص أو via Vercel Analytics / Cloudflare Web Analytics.
- **عتبات Alert:**
  - LCP p75 > 4s → P1.
  - INP p75 > 500ms → P2.
  - JS errors > 1% sessions → P1.

### Synthetic Monitoring
- Lighthouse CI أسبوعياً على: home, category, product, checkout.
- هدف: Performance ≥ 90 / SEO ≥ 95 / Accessibility ≥ 95.

### Database Performance
- **Slow queries:** فعّل log في Lovable Cloud (queries > 1s).
- مراجعة أسبوعية لـ `pg_stat_statements` (top 20 by total_time).
- **Alert** إذا تجاوز DB CPU 80% لـ 10 دقائق → اقتراح ترقية instance (`Cloud → Advanced settings → Upgrade instance`).

### استعلامات مفيدة
```sql
-- Top 10 slow queries
SELECT mean_exec_time, calls, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## 8. Logs مركزية

**المستويات:**
| Level | المصدر | المخزن | الاحتفاظ |
|---|---|---|---|
| App / Errors | الواجهة + server functions | `error_logs` | 90 يوم |
| Audit | تغييرات بيانات حساسة | `audit_logs` (immutable) | سنتان |
| Webhooks | inbound/outbound | `webhook_deliveries` | 30 يوم |
| Email | كل المحاولات | `email_send_log` | 90 يوم |
| Auth | login/logout/lockouts | `failed_login_attempts` + Supabase auth_logs | 30 يوم |
| HTTP edge | كل request للـ edge functions | Supabase function_edge_logs | 7 أيام (built-in) |
| Postgres | DB level | postgres_logs (built-in) | 7 أيام |

**ملاحظات:**
- لا تُسجَّل PII في الأخطاء (mask قبل الكتابة).
- لا تُسجَّل secrets/tokens في أي log.
- **Audit logs immutable** — trigger `prevent_audit_modification` يمنع UPDATE/DELETE.

**تصدير دوري** (أرشفة):
- Cron أسبوعي يصدّر logs > 30 يوم إلى bucket storage (CSV gzip) قبل الحذف.

---

## 9. التنبيهات (Alerts)

### قنوات
- **Slack `#alerts-prod`** — تنبيهات حية للفريق التقني.
- **Email** — `tech@maisonnet.com` للسجلات والملخصات.
- **SMS / WhatsApp للمناوب** — P0 فقط (3 صباحاً يصلك call).
- **PagerDuty / OpsGenie** (اختياري) — جدولة المناوبة.

### مصفوفة التنبيهات

| الحدث | Severity | القناة | الردّ المتوقع |
|---|---|---|---|
| Site down > 2 دقيقة | P0 | SMS + Slack | 15 دقيقة |
| DB unhealthy / paused | P0 | SMS + Slack | 15 دقيقة |
| Payment fail rate > 5% | P0 | Slack + Email | 30 دقيقة |
| Webhook signature invalid | P0 (security) | Slack + Email | 30 دقيقة |
| OTP SMS فشل جماعي | P0 | SMS + Slack | 15 دقيقة |
| Email DLQ > 2% | P1 | Slack | 2 ساعة |
| Slow query > 5s متكرر | P1 | Slack | 4 ساعات |
| Error rate > 1% | P1 | Slack | 2 ساعة |
| Inventory.low | P2 | Email لـ ops | يوم العمل التالي |
| Cart.abandoned > 100/يوم | P3 | Email لـ marketing | أسبوعي |

### قواعد منع spam
- **Deduplication:** نفس التنبيه خلال 30 دقيقة يُجمَّع.
- **Maintenance window** يكتم التنبيهات أثناء النشر المخطط.

---

## 10. Dashboards الإدارية

| Dashboard | المسار | المحتوى | الصلاحية |
|---|---|---|---|
| Overview | `/admin/dashboard` | KPIs (طلبات اليوم، إيراد، AOV، معدل التحويل) | admin |
| Errors | `/admin/errors` | أكثر الأخطاء، chart، تفاصيل | admin |
| Emails | `/admin/emails` | السجلات (deduped)، فلاتر، إحصائيات | admin |
| Notifications | `/admin/notifications` | SMS/WhatsApp logs | admin |
| Payments | `/admin/payments` | معدل النجاح/الفشل، أكواد الفشل | admin |
| Shipments | `/admin/shipments` | الشحنات المعلّقة، أداء الناقلين | admin/manager |
| Webhooks | `/admin/webhooks` | endpoints + آخر 50 محاولة تسليم | admin |
| Performance | `/admin/performance` | Web Vitals، slow queries | admin |
| Audit | `/admin/audit` | سجل التغييرات الحساسة | super_admin فقط |

---

## 11. النسخ الاحتياطي (Backups)

### المصدر التلقائي (Lovable Cloud / Supabase)
- **Daily backups** تُنفَّذ تلقائياً (Point-in-Time Recovery).
- الاحتفاظ:
  - Free/Pro: 7 أيام.
  - Team/Enterprise: 14-30 يوم + PITR لحظي.
- موقع التخزين: Supabase managed (مشفّر at rest).

### نسخ احتياطية يدوية إضافية
- **Cron يومي 3 صباحاً** يصدّر الجداول الحرجة إلى bucket خاص:
  - `orders`, `order_items`, `payments`, `profiles`, `products`, `inventory_items`.
  - تنسيق: CSV gzip + checksum SHA256.
  - الاحتفاظ: 90 يوم في bucket، ثم cold storage (إن وُجد).
- **Storage buckets** (`product-images`, `return-photos`):
  - Lifecycle policy: نسخ أسبوعية محتفظ بها 30 يوم.

### اختبار الاستعادة
- **شهرياً** — استرجاع snapshot عشوائي إلى بيئة test وفحص integrity.
- **توثيق وقت الاستعادة الفعلي** (للتأكد من تحقيق RTO).

---

## 12. خطة الاسترجاع (DR — Disaster Recovery)

### الأهداف
- **RTO** (Recovery Time Objective): ≤ 4 ساعات.
- **RPO** (Recovery Point Objective): ≤ 1 ساعة (PITR).

### سيناريوهات

| السيناريو | الإجراء | المسؤول | الوقت المتوقع |
|---|---|---|---|
| حذف بيانات عرضي (جدول/صفوف) | PITR إلى لحظة قبل الحذف | DBA | 30-60 دقيقة |
| تلف schema / migration خاطئة | rollback migration + استعادة snapshot | Tech lead | 1-2 ساعة |
| تسريب credentials | rotate كل secrets، فحص audit_logs، إعلام المستخدمين إن لزم | Security + Tech lead | 2-4 ساعات |
| Lovable Cloud outage إقليمي | انتظار الخدمة + تنبيه المستخدمين عبر status page | Ops | حسب المزوّد |
| DDoS / حمولة شديدة | تفعيل Cloudflare protection + ترقية instance | Ops | 30 دقيقة |
| Storage bucket مفقود | استعادة من النسخة الأسبوعية | Ops | 1-2 ساعة |

### Runbook للاستعادة
1. **Detection** — alert يصل.
2. **Triage** — تأكيد الحادث في `#alerts-prod`، إعلان incident.
3. **Communication** — status page تُحدَّث، إيميل للعملاء إذا > 30 دقيقة.
4. **Containment** — إيقاف النزيف (read-only mode إن لزم).
5. **Recovery** — تنفيذ خطوات الاسترجاع.
6. **Validation** — smoke tests + تأكد من الـ data integrity.
7. **Post-mortem** — خلال 48 ساعة، توثيق + إجراءات وقائية.

### Status Page
- صفحة عامة `/status` تعرض حالة الخدمات (web, checkout, payment, shipping, email).
- تحديث تلقائي من health checks.
- اشتراك العملاء بإشعارات الانقطاع.

---

## 13. CI/CD

> **ملاحظة:** Lovable يدير النشر تلقائياً (preview على كل تغيير، publish يدوي). الأدناه يخص أي extension للمشروع (custom GitHub repo).

### Pipeline (GitHub Actions مقترح)

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request, push]
jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run typecheck
      - run: bun run test
      - run: bun run build
  e2e:
    needs: lint-test
    runs-on: ubuntu-latest
    steps:
      - run: bunx playwright install
      - run: bun run test:e2e
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: snyk/actions/node@master
        with: { command: test }
```

### Branch Strategy
- `main` → Production (publish يدوي بعد QA).
- `develop` → Staging (auto-deploy).
- `feature/*` → Preview تلقائي عبر Lovable.

### Pre-deploy Checklist
- [ ] Tests خضراء.
- [ ] Lighthouse CI ≥ thresholds.
- [ ] `supabase--linter` لا warnings جديدة.
- [ ] Security scan (`security--run_security_scan`) نظيف.
- [ ] Migration tested على Staging.
- [ ] Changelog محدَّث.

### Post-deploy
- Smoke tests (5 دقائق — انظر `TEST_PLAN.md` §17).
- مراقبة `/admin/errors` لـ 30 دقيقة بعد النشر.
- Rollback خلال دقائق إذا ارتفع معدل الأخطاء > 2x baseline.

---

## 14. SLAs و SLOs

| الخدمة | SLO | SLI | السقف |
|---|---|---|---|
| Web availability | 99.9% | uptime checks | 43 دقيقة/شهر |
| Checkout success | ≥ 95% | (طلبات نجحت / محاولات) | — |
| Payment confirmation | < 30 ثانية | webhook arrival time | p95 |
| Email delivery | ≥ 98% | sent rows / total | 24 ساعة |
| API p95 latency | < 500ms | RUM + edge logs | — |
| Support ticket first response | < 4 ساعات | ticket data | working hours |

---

## 15. Runbooks (روابط سريعة)

| الموقف | المرجع |
|---|---|
| الموقع لا يفتح | `docs/RUNBOOKS/site-down.md` (TBD) |
| الدفع فاشل جماعياً | `docs/RUNBOOKS/payment-outage.md` |
| الإيميلات لا تصل | `docs/RUNBOOKS/email-failure.md` |
| استعادة من backup | `docs/RUNBOOKS/restore.md` |
| Rotate secrets | `docs/RUNBOOKS/secrets-rotation.md` |
| تحقيق Security incident | `docs/RUNBOOKS/security-incident.md` |

---

## 16. مصفوفة الجاهزية (Operational Readiness Checklist)

- [ ] Health endpoint `/api/public/health` يعمل
- [ ] Uptime monitor مفعَّل على 5 endpoints على الأقل
- [ ] `error_logs` تستقبل أخطاء (تأكد بإيقاف صفحة عمداً)
- [ ] `email_send_log` يحتوي على بيانات حقيقية ومكرَّر deduplication
- [ ] Slack webhook للتنبيهات مهيّأ
- [ ] Dashboards admin محمية (RLS + has_role)
- [ ] Backups يومية مفعَّلة + اختبار استعادة شهري
- [ ] DR Runbooks موثَّقة ومجرَّبة
- [ ] Status page منشورة
- [ ] Maintenance window معروفة (مثلاً 3-4 صباحاً يوم ثلاثاء)
- [ ] On-call rotation محدَّدة (3 أشخاص بحد أدنى)
- [ ] Post-mortem template جاهز
