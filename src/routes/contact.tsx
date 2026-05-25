import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/AuthContext";
import { Mail, Phone, MessageCircle, Send, CheckCircle2, HelpCircle, Package } from "lucide-react";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () =>
    buildMeta({
      title: "تواصل معنا — Le Petit Paradis",
      description:
        "تواصل مع خدمة عملاء Le Petit Paradis عبر واتساب أو البريد الإلكتروني أو نموذج الاتصال — نحن هنا لخدمتك.",
      path: "/contact",
    }),
});

const schema = z.object({
  name: z.string().trim().min(2, "الاسم قصير").max(100),
  email: z.string().trim().email("بريد غير صالح").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().min(5, "الرسالة قصيرة").max(2000),
});

function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>({});

  useEffect(() => {
    supabase.from("public_site_settings" as any).select("whatsapp_number,support_email").eq("id", 1).maybeSingle()
      .then(({ data }) => setContactInfo(data || {}));
    if (user?.email) setForm(f => ({ ...f, email: user.email! }));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach(er => { errs[er.path[0] as string] = er.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.from("contact_submissions").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      subject: parsed.data.subject || null,
      message: parsed.data.message,
    });
    setBusy(false);
    if (!error) {
      setDone(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } else alert(error.message);
  };

  const wa = contactInfo.whatsapp_number?.replace(/[^\d]/g, "");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" dir="rtl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">تواصل معنا</h1>
        <p className="mt-2 text-sm text-muted-foreground">نحن هنا لمساعدتك. اختر الطريقة الأنسب لك.</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-green-500/50">
            <MessageCircle className="h-6 w-6 text-green-500" />
            <span className="text-sm font-medium">WhatsApp</span>
            <span className="text-xs text-muted-foreground" dir="ltr">{contactInfo.whatsapp_number}</span>
          </a>
        )}
        {contactInfo.support_email && (
          <a href={`mailto:${contactInfo.support_email}`} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary/50">
            <Mail className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">البريد الإلكتروني</span>
            <span className="text-xs text-muted-foreground" dir="ltr">{contactInfo.support_email}</span>
          </a>
        )}
        {contactInfo.support_phone && (
          <a href={`tel:${contactInfo.support_phone}`} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary/50">
            <Phone className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">اتصال هاتفي</span>
            <span className="text-xs text-muted-foreground" dir="ltr">{contactInfo.support_phone}</span>
          </a>
        )}
        <Link to="/track-order" className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary/50">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium">تتبع طلب</span>
          <span className="text-xs text-muted-foreground">دون تسجيل</span>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">نموذج التواصل</h2>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold">شكراً لتواصلك!</h3>
              <p className="text-sm text-muted-foreground">سنرد عليك خلال 24 ساعة.</p>
              <button onClick={() => setDone(false)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">إرسال رسالة أخرى</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الاسم *" error={errors.name}>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label="البريد الإلكتروني *" error={errors.email}>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الجوال" error={errors.phone}>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} dir="ltr" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label="الموضوع" error={errors.subject}>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={150} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="الرسالة *" error={errors.message}>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} maxLength={2000} className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <Send className="h-4 w-4" />{busy ? "جاري الإرسال..." : "إرسال"}
              </button>
              <p className="text-[11px] text-muted-foreground">للحالات العاجلة المتعلقة بطلب موجود، فضلاً <Link to="/support/new" className="text-primary underline">افتح تذكرة دعم</Link>.</p>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <Link to="/help" className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/50">
            <HelpCircle className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">الأسئلة الشائعة</h3>
              <p className="text-xs text-muted-foreground">قد تجد إجابة سريعة هنا</p>
            </div>
          </Link>
          <Link to="/support/new" className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/50">
            <MessageCircle className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">فتح تذكرة دعم</h3>
              <p className="text-xs text-muted-foreground">للمتابعة الكاملة لاستفسارك</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
