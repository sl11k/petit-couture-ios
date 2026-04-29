import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/AuthContext";
import { CheckCircle2, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/support/new")({
  component: NewTicketPage,
  head: () =>
    buildMeta({
      title: "فتح تذكرة دعم — Maisonnét",
      description:
        "افتح تذكرة دعم لاستفسارك أو مشكلتك وسيتواصل معك فريق Maisonnét سريعاً.",
      path: "/support/new",
      noindex: true,
    }),
});

const CATEGORIES = [
  { v: "order_inquiry", l: "استفسار عن طلب" },
  { v: "payment_issue", l: "مشكلة دفع" },
  { v: "shipping_issue", l: "مشكلة شحن" },
  { v: "return", l: "طلب استرجاع" },
  { v: "damaged_product", l: "منتج تالف" },
  { v: "general", l: "استفسار عام" },
  { v: "other", l: "أخرى" },
];

const schema = z.object({
  subject: z.string().trim().min(3, "العنوان قصير").max(150),
  category: z.string(),
  customer_name: z.string().trim().min(2).max(100),
  customer_email: z.string().trim().email().max(255),
  customer_phone: z.string().trim().max(20).optional().or(z.literal("")),
  related_order_number: z.string().trim().max(50).optional().or(z.literal("")),
  message: z.string().trim().min(10, "اكتب وصفاً أكثر تفصيلاً").max(3000),
});

function NewTicketPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    subject: "", category: "general", customer_name: "", customer_email: "",
    customer_phone: "", related_order_number: "", message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any | null>(null);

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, customer_email: user.email! }));
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

    let related_order_id: string | null = null;
    if (parsed.data.related_order_number) {
      const { data: o } = await supabase.from("orders").select("id").eq("order_number", parsed.data.related_order_number).maybeSingle();
      if (o) related_order_id = o.id;
    }

    const { data: ticket, error } = await supabase.from("support_tickets").insert({
      subject: parsed.data.subject,
      category: parsed.data.category,
      customer_user_id: user?.id ?? null,
      customer_email: parsed.data.customer_email,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone || null,
      related_order_id,
      related_order_number: parsed.data.related_order_number || null,
      source: "web",
      status: "new",
    }).select().single();

    if (error || !ticket) { setBusy(false); alert(error?.message); return; }

    await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      body: parsed.data.message,
      direction: "customer",
      author_id: user?.id ?? null,
      author_email: parsed.data.customer_email,
      author_name: parsed.data.customer_name,
    });

    setBusy(false);
    setCreatedTicket(ticket);
  };

  if (createdTicket) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center" dir="rtl">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h1 className="mt-3 text-xl font-semibold">تم إنشاء التذكرة بنجاح</h1>
        <p className="mt-2 text-sm text-muted-foreground">رقم تذكرتك:</p>
        <p className="mt-1 text-lg font-mono font-bold">{createdTicket.ticket_number}</p>
        <p className="mt-3 text-xs text-muted-foreground">احتفظ بالرقم لمتابعة تذكرتك. سنرد عليك قريباً عبر البريد.</p>
        <div className="mt-6 flex justify-center gap-2">
          {user && <Link to="/account" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">عرض تذاكري</Link>}
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm">العودة للمتجر</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8" dir="rtl">
      <div className="mb-6 flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">فتح تذكرة دعم</h1>
          <p className="text-xs text-muted-foreground">أخبرنا بمشكلتك بالتفصيل وسيتواصل معك أحد ممثلي الدعم.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم *" error={errors.customer_name}>
            <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} maxLength={100} className="input" />
          </Field>
          <Field label="البريد *" error={errors.customer_email}>
            <input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} maxLength={255} dir="ltr" className="input" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الجوال">
            <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} maxLength={20} dir="ltr" className="input" />
          </Field>
          <Field label="رقم الطلب (إن وجد)">
            <input value={form.related_order_number} onChange={(e) => setForm({ ...form, related_order_number: e.target.value })} maxLength={50} dir="ltr" className="input" placeholder="MN-XXXXXX-XXXX" />
          </Field>
        </div>
        <Field label="نوع المشكلة *">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
            {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </Field>
        <Field label="عنوان قصير *" error={errors.subject}>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={150} className="input" />
        </Field>
        <Field label="الوصف *" error={errors.message}>
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} maxLength={3000} className="input resize-none" />
        </Field>
        <button type="submit" disabled={busy} className="rounded-md bg-primary px-5 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "جاري الإرسال..." : "إرسال التذكرة"}
        </button>
      </form>

      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:.375rem;padding:.5rem .75rem;font-size:.875rem;color:hsl(var(--foreground))}`}</style>
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
