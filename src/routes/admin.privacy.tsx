import { createFileRoute } from "@tanstack/react-router";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/features/admin/components/PageHeader";
import { ShieldCheck, Eye, FileText, Lock } from "lucide-react";

export const Route = createFileRoute("/admin/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const items = [
    {
      icon: ShieldCheck,
      title: ar ? "إخفاء بيانات العملاء" : "Customer PII masking",
      desc: ar
        ? "البريد ورقم الهاتف يُخفيان تلقائياً للموظفين بدون صلاحية customers.view_pii."
        : "Email and phone are masked for staff without customers.view_pii permission.",
    },
    {
      icon: Eye,
      title: ar ? "سجل الوصول للبيانات" : "Data access audit",
      desc: ar
        ? "كل عرض أو تعديل لبيانات العميل يُسجَّل في سجل العمليات."
        : "All views and edits of customer data are recorded in the audit log.",
    },
    {
      icon: Lock,
      title: ar ? "تشفير الاتصال" : "Transport encryption",
      desc: ar
        ? "جميع الاتصالات تتم عبر HTTPS مع TLS 1.2 أو أعلى."
        : "All connections use HTTPS with TLS 1.2 or higher.",
    },
    {
      icon: FileText,
      title: ar ? "حذف البيانات (GDPR)" : "Right to erasure (GDPR)",
      desc: ar
        ? "يمكن حذف حساب العميل وبياناته الشخصية بناءً على طلبه."
        : "Customer accounts and personal data can be deleted upon request.",
    },
  ];

  return (
    <div>
      <PageHeader
        title={{ ar: "الخصوصية", en: "Privacy" }}
        description={{ ar: "سياسات حماية بيانات العملاء", en: "Customer data protection policies" }}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <it.icon className="h-4 w-4 text-primary" />
              <div className="text-sm font-medium">{it.title}</div>
            </div>
            <p className="text-xs text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
