import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  component: Unsubscribe,
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
});

function Unsubscribe() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [status, setStatus] = useState<"loading" | "ok" | "invalid" | "already" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [channel, setChannel] = useState<string>("email");

  useEffect(() => {
    void (async () => {
      if (!token) { setStatus("invalid"); return; }
      const { data, error } = await db.from("unsubscribe_tokens").select("*").eq("token", token).maybeSingle();
      if (error || !data) { setStatus("invalid"); return; }
      if (data.used_at) { setEmail(data.email); setChannel(data.channel); setStatus("already"); return; }
      setEmail(data.email); setChannel(data.channel);
      // Mark token used
      await db.from("unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);
      // Update consent
      if (data.user_id) {
        const col = `marketing_${data.channel}`;
        await db.from("customer_consents").upsert({
          user_id: data.user_id, [col]: false, source: "unsubscribe_link", updated_at: new Date().toISOString(),
        });
      }
      setStatus("ok");
    })();
  }, [token]);

  return (
    <main dir="rtl" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      {status === "loading" && <p className="text-sm text-muted-foreground">جاري المعالجة...</p>}
      {(status === "ok" || status === "already") && (
        <>
          <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" />
          <h1 className="mb-2 text-2xl font-bold">{status === "already" ? "تم الإلغاء سابقًا" : "تم إلغاء الاشتراك"}</h1>
          <p className="text-sm text-muted-foreground">
            لن تصلك المزيد من رسائل {channel === "email" ? "البريد التسويقية" : channel === "sms" ? "SMS التسويقية" : channel} {email && <>على <b>{email}</b></>}.
          </p>
          <a href="/account/privacy" className="mt-4 text-sm text-primary underline">إدارة كل التفضيلات</a>
        </>
      )}
      {status === "invalid" && (
        <>
          <XCircle className="mb-4 h-14 w-14 text-rose-500" />
          <h1 className="mb-2 text-2xl font-bold">رابط غير صالح</h1>
          <p className="text-sm text-muted-foreground">قد يكون الرابط منتهي الصلاحية أو غير صحيح.</p>
        </>
      )}
    </main>
  );
}
