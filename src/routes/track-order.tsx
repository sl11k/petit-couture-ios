import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { findTrackingToken } from "@/lib/tracking.functions";
import { Search, Package } from "lucide-react";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/track-order")({
  component: TrackPage,
  head: () =>
    buildMeta({
      title: "تتبع الطلب — Le Petit Paradis",
      description:
        "تتبع حالة طلبك من Le Petit Paradis دون الحاجة لتسجيل الدخول — أدخل رقم الطلب والبريد الإلكتروني.",
      path: "/track-order",
      noindex: true,
    }),
});

const schema = z.object({
  order_number: z.string().trim().min(3).max(50),
  email: z.string().trim().email().max(255),
});

function TrackPage() {
  const navigate = useNavigate();
  const lookup = useServerFn(findTrackingToken);
  const [orderNum, setOrderNum] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = schema.safeParse({ order_number: orderNum, email });
    if (!parsed.success) { setError("تحقق من رقم الطلب والبريد"); return; }
    setBusy(true);
    try {
      const res: any = await lookup({ data: { orderNumber: parsed.data.order_number, email: parsed.data.email } });
      if (!res?.ok) { setError("لم نجد طلباً مطابقاً. تأكد من البيانات."); return; }
      await navigate({ to: "/track/$token", params: { token: res.token } });
    } catch {
      setError("تعذر البحث حالياً، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8" dir="rtl">
      <div className="mb-6 text-center">
        <Package className="mx-auto mb-2 h-10 w-10 text-primary" />
        <h1 className="text-2xl font-semibold">تتبع الطلب</h1>
        <p className="mt-1 text-sm text-muted-foreground">أدخل رقم الطلب والبريد الإلكتروني لمتابعة حالة طلبك</p>
      </div>

      <form onSubmit={search} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div>
          <label className="mb-1 block text-xs font-medium">رقم الطلب</label>
          <input value={orderNum} onChange={(e) => setOrderNum(e.target.value)} placeholder="MN-XXXXXX-XXXX" maxLength={50} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">البريد الإلكتروني</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" dir="ltr" />
        </div>
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Search className="h-4 w-4" />{busy ? "جاري البحث..." : "تتبع"}
        </button>
        {error && <p className="text-center text-xs text-red-500">{error}</p>}
      </form>

    </div>
  );
}
