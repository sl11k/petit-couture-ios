import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/state/AuthContext";
import {
  getConsents, setConsents, requestDataExport, requestAccountDeletion,
  cancelAccountDeletion, buildSelfDataExport, type Consents,
} from "@/lib/privacy";
import { db } from "@/lib/db";
import { Shield, Download, Trash2, AlertTriangle, CheckCircle2, Mail, MessageSquare, Bell, Phone } from "lucide-react";

export const Route = createFileRoute("/account/privacy")({
  head: () =>
    buildMeta({
      title: "خصوصية الحساب — Maisonnét",
      description:
        "إدارة موافقاتك، تصدير بياناتك، أو طلب حذف حسابك من Maisonnét.",
      path: "/account/privacy",
      noindex: true,
    }),
  component: AccountPrivacy,
  beforeLoad: ({ context }: any) => {
    if (typeof window !== "undefined") {
      // client-side guard: if no auth, redirect to login
    }
  },
});

function AccountPrivacy() {
  const { user, ready } = useAuth();
  const [c, setC] = useState<Consents | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<any>(null);
  const [exports, setExports] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) { window.location.href = "/login?redirect=/account/privacy"; return; }
    void load();
  }, [user, ready]);

  async function load() {
    if (!user) return;
    const [consents, del, exp] = await Promise.all([
      getConsents(user.id),
      db.from("account_deletion_requests").select("*").eq("user_id", user.id).eq("status", "pending").maybeSingle(),
      db.from("data_export_requests").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(5),
    ]);
    setC(consents);
    setPendingDeletion(del.data);
    setExports(exp.data ?? []);
  }

  async function save() {
    if (!user || !c) return;
    setSaving(true); setMsg(null);
    await setConsents(user.id, c);
    setSaving(false); setMsg("تم حفظ تفضيلاتك ✓");
    setTimeout(() => setMsg(null), 3000);
  }

  async function downloadMyData() {
    if (!user) return;
    const data = await buildSelfDataExport(user.id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    await requestDataExport(user.id);
    void load();
  }

  async function requestDelete() {
    if (!user) return;
    const reason = prompt("سبب الحذف (اختياري):") ?? undefined;
    if (!confirm("سيُجدول حذف حسابك خلال 30 يومًا. تأكد؟")) return;
    await requestAccountDeletion(user.id, reason);
    void load();
  }

  async function cancelDelete() {
    if (!user) return;
    await cancelAccountDeletion(user.id);
    void load();
  }

  if (!ready || !c) return <main className="p-10 text-center text-sm text-muted-foreground">جاري التحميل...</main>;

  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">الخصوصية والتفضيلات</h1>
          <p className="text-xs text-muted-foreground">تحكّم بكامل بياناتك ورسائلك التسويقية</p>
        </div>
      </header>

      {msg && <p className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700">{msg}</p>}

      {/* Marketing consents */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">الرسائل التسويقية</h2>
        <p className="mb-4 text-xs text-muted-foreground">لن نرسل أي حملة تسويقية إلا للقنوات التي توافق عليها.</p>
        <div className="space-y-2">
          <ConsentRow icon={Mail} label="بريد إلكتروني" v={c.marketing_email} on={(v) => setC({ ...c, marketing_email: v })} />
          <ConsentRow icon={MessageSquare} label="رسائل SMS" v={c.marketing_sms} on={(v) => setC({ ...c, marketing_sms: v })} />
          <ConsentRow icon={Phone} label="WhatsApp" v={c.marketing_whatsapp} on={(v) => setC({ ...c, marketing_whatsapp: v })} />
          <ConsentRow icon={Bell} label="إشعارات Push" v={c.marketing_push} on={(v) => setC({ ...c, marketing_push: v })} />
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">رسائل ضرورية (طلباتك ودعمك)</h3>
        <div className="space-y-2">
          <ConsentRow icon={Mail} label="إشعارات الطلبات بالبريد" v={c.transactional_email} on={(v) => setC({ ...c, transactional_email: v })} />
          <ConsentRow icon={MessageSquare} label="إشعارات الطلبات SMS" v={c.transactional_sms} on={(v) => setC({ ...c, transactional_sms: v })} />
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">معالجة البيانات</h3>
        <div className="space-y-2">
          <ConsentRow label="السماح بمشاركة بياناتي مع شركاء موثوقين (تسويق مخصص)"
            v={c.third_party_sharing} on={(v) => setC({ ...c, third_party_sharing: v })} />
        </div>

        <button onClick={save} disabled={saving}
          className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ التفضيلات"}
        </button>
      </section>

      {/* Data export */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">تصدير بياناتي</h2>
            <p className="text-xs text-muted-foreground">حمّل نسخة بصيغة JSON تحتوي على جميع بياناتك (طلبات، عناوين، تفضيلات...).</p>
          </div>
          <button onClick={downloadMyData}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground hover:opacity-90">
            <Download className="h-3.5 w-3.5" /> تحميل بياناتي
          </button>
        </div>
        {exports.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <p className="font-semibold">سجل التصديرات السابقة:</p>
            {exports.map((e) => (
              <p key={e.id}>{new Date(e.requested_at).toLocaleString("ar")} — {e.status}</p>
            ))}
          </div>
        )}
      </section>

      {/* Account deletion */}
      <section className="rounded-2xl border border-rose-300/40 bg-rose-50/30 p-5 dark:bg-rose-950/10">
        <div className="mb-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <h2 className="text-sm font-semibold text-rose-800 dark:text-rose-300">حذف الحساب</h2>
            <p className="text-xs text-muted-foreground">عند طلب الحذف، يُجدول لاحقًا خلال 30 يومًا (يمكنك الإلغاء قبل ذلك).</p>
          </div>
        </div>

        {pendingDeletion ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <p className="mb-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <CheckCircle2 className="h-4 w-4" /> طلب الحذف مُجدول للتنفيذ في{" "}
              <b>{new Date(pendingDeletion.scheduled_for).toLocaleDateString("ar")}</b>
            </p>
            <button onClick={cancelDelete} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
              إلغاء طلب الحذف
            </button>
          </div>
        ) : (
          <button onClick={requestDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-400 bg-white px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:bg-transparent dark:hover:bg-rose-950/30">
            <Trash2 className="h-3.5 w-3.5" /> طلب حذف حسابي
          </button>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        راجع <a href="/privacy" className="text-primary underline">سياسة الخصوصية</a> الكاملة.
      </p>
    </main>
  );
}

function ConsentRow({ icon: Icon, label, v, on }: { icon?: any; label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
      <span className="flex items-center gap-2 text-xs">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </span>
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-5 w-5" />
    </label>
  );
}
