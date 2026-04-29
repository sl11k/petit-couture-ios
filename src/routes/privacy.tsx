import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { buildMeta } from "@/lib/seo";
import { useLanguage } from "@/i18n/LanguageContext";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
  head: () =>
    buildMeta({
      title: "سياسة الخصوصية — Maisonnét",
      description:
        "كيف نحمي بياناتك الشخصية في Maisonnét: ما نجمعه، كيف نستخدمه، وحقوقك في الوصول والتعديل والحذف.",
      path: "/privacy",
    }),
});

function PrivacyPolicy() {
  const { lang, isRTL } = useLanguage();
  const ar = lang === "ar";

  const sections = ar
    ? AR_SECTIONS
    : EN_SECTIONS;

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
          <p className="text-sm text-muted-foreground">
            {ar ? "آخر تحديث" : "Last updated"}: {new Date().toLocaleDateString(ar ? "ar" : "en")}
          </p>
        </div>
      </header>

      <div className="prose prose-sm max-w-none space-y-6 text-sm leading-7">
        {sections.map((s, i) => (
          <Section key={i} title={s.title}>
            {s.body}
          </Section>
        ))}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  );
}

const AR_SECTIONS = [
  {
    title: "1. البيانات التي نجمعها",
    body: (
      <ul className="list-disc space-y-1 pe-5">
        <li>بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف، كلمة المرور (مشفّرة).</li>
        <li>بيانات الطلبات: العناوين، تفاصيل الطلب، تاريخ الشراء.</li>
        <li>بيانات تقنية: عنوان IP، نوع المتصفح، الجهاز، صفحات الزيارة.</li>
        <li>الكوكيز: حسب اختيارك في لوحة الكوكيز.</li>
      </ul>
    ),
  },
  {
    title: "2. كيف نستخدم بياناتك",
    body: (
      <ul className="list-disc space-y-1 pe-5">
        <li>تنفيذ طلباتك وتوصيلها.</li>
        <li>التواصل بشأن طلباتك ودعم العملاء.</li>
        <li>إرسال رسائل تسويقية فقط بعد موافقتك الصريحة.</li>
        <li>تحسين الموقع وتجربة الاستخدام.</li>
        <li>الامتثال للالتزامات القانونية.</li>
      </ul>
    ),
  },
  {
    title: "3. مشاركة البيانات",
    body: (
      <>
        <p>لا نبيع بياناتك. نشاركها فقط مع:</p>
        <ul className="list-disc space-y-1 pe-5">
          <li>شركات الشحن (لتسليم الطلبات).</li>
          <li>بوابات الدفع (دون تخزين بيانات بطاقتك لدينا).</li>
          <li>مزودي الخدمة الموثوقين (تحليلات، رسائل) ضمن حدود ضرورية.</li>
          <li>الجهات الحكومية عند المطالبة القانونية فقط.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. حقوقك",
    body: (
      <ul className="list-disc space-y-1 pe-5">
        <li>الاطلاع على بياناتك وتعديلها في أي وقت من <a href="/account/privacy" className="text-primary underline">إعدادات الخصوصية</a>.</li>
        <li>تصدير نسخة من بياناتك (JSON).</li>
        <li>سحب الموافقة على الرسائل التسويقية في أي لحظة.</li>
        <li>طلب حذف حسابك (مع مهلة 30 يومًا قابلة للإلغاء).</li>
      </ul>
    ),
  },
  { title: "5. الأمان", body: <p>نحمي بياناتك بـ HTTPS، تشفير قواعد البيانات، RLS، 2FA للمدراء، ومراقبة المحاولات المشبوهة.</p> },
  { title: "6. ملفات تعريف الارتباط (Cookies)", body: <p>تستخدم كوكيز ضرورية لتشغيل الموقع، وأخرى اختيارية تخضع لموافقتك من شريط الكوكيز.</p> },
  { title: "7. الاحتفاظ بالبيانات", body: <p>نحتفظ ببيانات الطلبات وفق المتطلبات المحاسبية والقانونية، ونحذف بيانات الحسابات المعطّلة بعد المهلة المحددة.</p> },
  { title: "8. التواصل", body: <p>لأي استفسار عن خصوصيتك، تواصل معنا عبر <a href="/contact" className="text-primary underline">صفحة التواصل</a>.</p> },
];

const EN_SECTIONS = [
  {
    title: "1. Data We Collect",
    body: (
      <ul className="list-disc space-y-1 ps-5">
        <li>Account data: name, email, phone, password (hashed).</li>
        <li>Order data: addresses, order details, purchase history.</li>
        <li>Technical data: IP address, browser, device, pages visited.</li>
        <li>Cookies: based on your cookie panel choices.</li>
      </ul>
    ),
  },
  {
    title: "2. How We Use Your Data",
    body: (
      <ul className="list-disc space-y-1 ps-5">
        <li>Fulfill and deliver your orders.</li>
        <li>Communicate about orders and customer support.</li>
        <li>Send marketing messages only with your explicit consent.</li>
        <li>Improve the site and user experience.</li>
        <li>Comply with legal obligations.</li>
      </ul>
    ),
  },
  {
    title: "3. Data Sharing",
    body: (
      <>
        <p>We never sell your data. We share only with:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>Shipping carriers (to deliver orders).</li>
          <li>Payment gateways (we never store your card data).</li>
          <li>Trusted service providers (analytics, messaging) within strict limits.</li>
          <li>Government authorities only when legally required.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4. Your Rights",
    body: (
      <ul className="list-disc space-y-1 ps-5">
        <li>Access and edit your data anytime from <a href="/account/privacy" className="text-primary underline">Privacy settings</a>.</li>
        <li>Export a copy of your data (JSON).</li>
        <li>Withdraw consent for marketing at any time.</li>
        <li>Request deletion of your account (with a 30-day reversible grace period).</li>
      </ul>
    ),
  },
  { title: "5. Security", body: <p>We protect your data with HTTPS, database encryption, RLS, admin 2FA, and suspicious-activity monitoring.</p> },
  { title: "6. Cookies", body: <p>We use necessary cookies to operate the site and optional cookies subject to your consent in the cookie banner.</p> },
  { title: "7. Data Retention", body: <p>We retain order data per accounting and legal requirements, and delete deactivated account data after the defined grace period.</p> },
  { title: "8. Contact", body: <p>For any privacy questions, reach us via the <a href="/contact" className="text-primary underline">Contact page</a>.</p> },
];
