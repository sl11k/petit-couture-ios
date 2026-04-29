import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية" },
      { name: "description", content: "سياسة الخصوصية وحماية البيانات الخاصة بالعملاء" },
    ],
  }),
});

function PrivacyPolicy() {
  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">سياسة الخصوصية</h1>
          <p className="text-sm text-muted-foreground">آخر تحديث: {new Date().toLocaleDateString("ar")}</p>
        </div>
      </header>

      <div className="prose prose-sm max-w-none space-y-6 text-sm leading-7">
        <Section title="1. البيانات التي نجمعها">
          <ul className="list-disc space-y-1 pe-5">
            <li>بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف، كلمة المرور (مشفّرة).</li>
            <li>بيانات الطلبات: العناوين، تفاصيل الطلب، تاريخ الشراء.</li>
            <li>بيانات تقنية: عنوان IP، نوع المتصفح، الجهاز، صفحات الزيارة.</li>
            <li>الكوكيز: حسب اختيارك في لوحة الكوكيز.</li>
          </ul>
        </Section>

        <Section title="2. كيف نستخدم بياناتك">
          <ul className="list-disc space-y-1 pe-5">
            <li>تنفيذ طلباتك وتوصيلها.</li>
            <li>التواصل بشأن طلباتك ودعم العملاء.</li>
            <li>إرسال رسائل تسويقية فقط بعد موافقتك الصريحة.</li>
            <li>تحسين الموقع وتجربة الاستخدام.</li>
            <li>الامتثال للالتزامات القانونية.</li>
          </ul>
        </Section>

        <Section title="3. مشاركة البيانات">
          <p>لا نبيع بياناتك. نشاركها فقط مع:</p>
          <ul className="list-disc space-y-1 pe-5">
            <li>شركات الشحن (لتسليم الطلبات).</li>
            <li>بوابات الدفع (دون تخزين بيانات بطاقتك لدينا).</li>
            <li>مزودي الخدمة الموثوقين (تحليلات، رسائل) ضمن حدود ضرورية.</li>
            <li>الجهات الحكومية عند المطالبة القانونية فقط.</li>
          </ul>
        </Section>

        <Section title="4. حقوقك">
          <ul className="list-disc space-y-1 pe-5">
            <li>الاطلاع على بياناتك وتعديلها في أي وقت من <a href="/account/privacy" className="text-primary underline">إعدادات الخصوصية</a>.</li>
            <li>تصدير نسخة من بياناتك (JSON).</li>
            <li>سحب الموافقة على الرسائل التسويقية في أي لحظة.</li>
            <li>طلب حذف حسابك (مع مهلة 30 يومًا قابلة للإلغاء).</li>
          </ul>
        </Section>

        <Section title="5. الأمان">
          <p>نحمي بياناتك بـ HTTPS، تشفير قواعد البيانات، RLS، 2FA للمدراء، ومراقبة المحاولات المشبوهة.</p>
        </Section>

        <Section title="6. ملفات تعريف الارتباط (Cookies)">
          <p>تستخدم كوكيز ضرورية لتشغيل الموقع، وأخرى اختيارية تخضع لموافقتك من شريط الكوكيز.</p>
        </Section>

        <Section title="7. الاحتفاظ بالبيانات">
          <p>نحتفظ ببيانات الطلبات وفق المتطلبات المحاسبية والقانونية، ونحذف بيانات الحسابات المعطّلة بعد المهلة المحددة.</p>
        </Section>

        <Section title="8. التواصل">
          <p>لأي استفسار عن خصوصيتك، تواصل معنا عبر <a href="/contact" className="text-primary underline">صفحة التواصل</a>.</p>
        </Section>
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
