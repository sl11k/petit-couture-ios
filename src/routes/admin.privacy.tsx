import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { db } from "@/lib/db";
import { useUserRole } from "@/hooks/useUserRole";
import { Shield, Download, UserX, RotateCcw, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/privacy")({ component: AdminPrivacy });

type DelRow = {
  id: string; user_id: string; status: string; reason: string | null;
  requested_at: string; scheduled_for: string; cancelled_at: string | null; completed_at: string | null;
};
type ExpRow = { id: string; user_id: string; status: string; requested_at: string; completed_at: string | null };

function AdminPrivacy() {
  const { isSuperAdmin, can } = useUserRole();
  const canManage = isSuperAdmin || can("customers.manage_privacy");
  const [tab, setTab] = useState<"deletions" | "exports" | "consents" | "cookies">("deletions");

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Shield className="h-5 w-5 text-primary" /> إدارة الخصوصية
        </h1>
        <p className="text-xs text-muted-foreground">طلبات حذف الحسابات، تصدير البيانات، الموافقات التسويقية وكوكيز الزوار</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {[
          { id: "deletions", label: "طلبات الحذف" },
          { id: "exports", label: "طلبات التصدير" },
          { id: "consents", label: "الموافقات التسويقية" },
          { id: "cookies", label: "موافقة الكوكيز" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`rounded-lg px-3 py-2 text-xs ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "deletions" && <DeletionsTab canManage={canManage} />}
      {tab === "exports" && <ExportsTab canManage={canManage} />}
      {tab === "consents" && <ConsentsTab />}
      {tab === "cookies" && <CookiesTab />}
    </AdminShell>
  );
}

function DeletionsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<DelRow[]>([]);
  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await db.from("account_deletion_requests").select("*").order("requested_at", { ascending: false }).limit(200);
    setRows((data ?? []) as DelRow[]);
  }
  async function complete(r: DelRow) {
    if (!canManage || !confirm("سيتم حذف بيانات الحساب نهائيًا. متأكد؟")) return;
    await db.from("profiles").update({
      email: `deleted-${r.user_id.slice(0, 8)}@anon.local`, full_name: "[محذوف]", phone: null,
    }).eq("user_id", r.user_id);
    await db.from("customer_consents").update({
      marketing_email: false, marketing_sms: false, marketing_whatsapp: false, marketing_push: false,
      transactional_email: false, transactional_sms: false,
    }).eq("user_id", r.user_id);
    await db.from("account_deletion_requests").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", r.id);
    void load();
  }
  async function cancel(r: DelRow) {
    if (!canManage) return;
    await db.from("account_deletion_requests").update({
      status: "cancelled", cancelled_at: new Date().toISOString(),
    }).eq("id", r.id);
    void load();
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
          <tr><th className="p-3">المستخدم</th><th className="p-3">السبب</th><th className="p-3">طُلب في</th><th className="p-3">مجدول</th><th className="p-3">الحالة</th><th className="p-3">إجراءات</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 last:border-0">
              <td className="p-3 font-mono text-[10px]">{r.user_id.slice(0, 8)}</td>
              <td className="p-3 text-xs text-muted-foreground">{r.reason ?? "—"}</td>
              <td className="p-3 text-xs">{new Date(r.requested_at).toLocaleDateString("ar")}</td>
              <td className="p-3 text-xs">{new Date(r.scheduled_for).toLocaleDateString("ar")}</td>
              <td className="p-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                  r.status === "pending" ? "bg-amber-500/10 text-amber-600" :
                  r.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                  "bg-muted text-muted-foreground"
                }`}>{r.status}</span>
              </td>
              <td className="p-3">
                {r.status === "pending" && canManage && (
                  <div className="flex gap-2">
                    <button onClick={() => complete(r)} className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline">
                      <UserX className="h-3 w-3" /> تنفيذ
                    </button>
                    <button onClick={() => cancel(r)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                      <RotateCcw className="h-3 w-3" /> إلغاء
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">لا توجد طلبات</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ExportsTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<ExpRow[]>([]);
  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await db.from("data_export_requests").select("*").order("requested_at", { ascending: false }).limit(200);
    setRows((data ?? []) as ExpRow[]);
  }
  async function markComplete(id: string) {
    if (!canManage) return;
    await db.from("data_export_requests").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
    void load();
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
          <tr><th className="p-3">المستخدم</th><th className="p-3">طُلب في</th><th className="p-3">الحالة</th><th className="p-3">إجراء</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 last:border-0">
              <td className="p-3 font-mono text-[10px]">{r.user_id.slice(0, 8)}</td>
              <td className="p-3 text-xs">{new Date(r.requested_at).toLocaleString("ar")}</td>
              <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{r.status}</span></td>
              <td className="p-3">
                {r.status === "pending" && canManage && (
                  <button onClick={() => markComplete(r.id)} className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                    <CheckCircle2 className="h-3 w-3" /> وُسم كمكتمل
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">لا توجد طلبات</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ConsentsTab() {
  const [stats, setStats] = useState({ email: 0, sms: 0, whatsapp: 0, push: 0, total: 0 });
  useEffect(() => {
    void (async () => {
      const [e, s, w, p, t] = await Promise.all([
        db.from("customer_consents").select("user_id", { count: "exact", head: true }).eq("marketing_email", true),
        db.from("customer_consents").select("user_id", { count: "exact", head: true }).eq("marketing_sms", true),
        db.from("customer_consents").select("user_id", { count: "exact", head: true }).eq("marketing_whatsapp", true),
        db.from("customer_consents").select("user_id", { count: "exact", head: true }).eq("marketing_push", true),
        db.from("customer_consents").select("user_id", { count: "exact", head: true }),
      ]);
      setStats({ email: e.count ?? 0, sms: s.count ?? 0, whatsapp: w.count ?? 0, push: p.count ?? 0, total: t.count ?? 0 });
    })();
  }, []);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "بريد", v: stats.email }, { label: "SMS", v: stats.sms },
          { label: "WhatsApp", v: stats.whatsapp }, { label: "Push", v: stats.push },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">موافقون على {s.label}</p>
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-[10px] text-muted-foreground">من أصل {stats.total}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-blue-300/30 bg-blue-50/40 p-3 text-xs text-blue-800 dark:bg-blue-950/20 dark:text-blue-300">
        💡 الحملات التسويقية تستهدف فقط المستخدمين الموافقين عبر <code>filterOptedInRecipients()</code> في كود الإرسال.
      </div>
    </div>
  );
}

function CookiesTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void db.from("cookie_consents").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }: any) => setRows(data ?? []));
  }, []);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
          <tr><th className="p-3">التاريخ</th><th className="p-3">زائر</th><th className="p-3">تحليلية</th><th className="p-3">تسويقية</th><th className="p-3">تفضيلات</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 last:border-0">
              <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString("ar")}</td>
              <td className="p-3 font-mono text-[10px] text-muted-foreground">{(r.visitor_id ?? "").slice(0, 8)}</td>
              <td className="p-3 text-xs">{r.analytics ? "✓" : "—"}</td>
              <td className="p-3 text-xs">{r.marketing ? "✓" : "—"}</td>
              <td className="p-3 text-xs">{r.preferences ? "✓" : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">لا توجد سجلات</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
