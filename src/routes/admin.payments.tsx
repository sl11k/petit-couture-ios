import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/state/AuthContext";
import { toast } from "sonner";
import { createRefund, paymentStatusLabel } from "@/lib/payments";
import {
  CreditCard,
  Search,
  Download,
  RefreshCw,
  Undo2,
  Eye,
  AlertTriangle,
  TrendingUp,
  Settings as SettingsIcon,
  Shield,
  Webhook,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

type Txn = any;
type MethodConfig = any;

function PaymentsPage() {
  const { user } = useAuth();
  const { canManage, isAdmin } = useUserRole();
  const [tab, setTab] = useState<"transactions" | "methods" | "webhooks">("transactions");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [methods, setMethods] = useState<MethodConfig[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gatewayFilter, setGatewayFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Txn | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [txnRes, mRes, wRes] = await Promise.all([
      supabase.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("payment_method_configs").select("*").order("display_order"),
      supabase.from("payment_webhooks_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTxns(txnRes.data || []);
    setMethods(mRes.data || []);
    setWebhooks(wRes.data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (gatewayFilter !== "all" && t.gateway !== gatewayFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (t.order_number || "").toLowerCase().includes(q) ||
          (t.customer_email || "").toLowerCase().includes(q) ||
          (t.customer_name || "").toLowerCase().includes(q) ||
          (t.gateway_transaction_id || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [txns, statusFilter, gatewayFilter, search]);

  const stats = useMemo(() => {
    const captured = txns.filter((t) => t.status === "captured" || t.status === "paid");
    const totalCaptured = captured.reduce((s, t) => s + Number(t.amount), 0);
    const totalFees = captured.reduce((s, t) => s + Number(t.gateway_fee || 0), 0);
    const failed = txns.filter((t) => t.status === "failed").length;
    const refunded = txns.filter((t) => t.status === "refunded" || t.status === "partially_refunded").length;
    const successRate = txns.length ? (captured.length / txns.length) * 100 : 0;
    return { totalCaptured, totalFees, failed, refunded, successRate, count: txns.length };
  }, [txns]);

  function exportCSV() {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    const headers = ["التاريخ", "رقم الطلب", "العميل", "المبلغ", "العملة", "البوابة", "الطريقة", "الحالة", "Transaction ID", "الرسوم", "خطأ"];
    const rows = filtered.map((t) => [
      new Date(t.created_at).toLocaleString("ar"),
      t.order_number || "",
      t.customer_name || t.customer_email || "",
      Number(t.amount).toFixed(2),
      t.currency,
      t.gateway,
      t.gateway_method || "",
      t.status,
      t.gateway_transaction_id || "",
      Number(t.gateway_fee || 0).toFixed(2),
      t.error_message || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleMethod(m: MethodConfig) {
    if (!isAdmin) return toast.error("للأدمن فقط");
    const { error } = await supabase
      .from("payment_method_configs")
      .update({ is_enabled: !m.is_enabled })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(m.is_enabled ? "تم التعطيل" : "تم التفعيل");
    void loadAll();
  }

  async function performRefund(amount: number, reason: string) {
    if (!selected || !canManage) return;
    const { error } = await createRefund({
      transaction_id: selected.id,
      order_id: selected.order_id,
      amount,
      reason,
      approved_by: user?.id,
      approved_by_email: user?.email,
    });
    if (error) return toast.error((error as Error).message);
    await supabase.from("audit_logs").insert({
      action: "refund_processed",
      entity: "payment_transaction",
      entity_id: selected.id,
      actor_id: user?.id,
      actor_email: user?.email,
      metadata: { amount, reason },
    });
    toast.success("تم الاسترداد بنجاح");
    setRefundOpen(false);
    setSelected(null);
    void loadAll();
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">المدفوعات</h1>
            <p className="text-sm text-muted-foreground">إدارة المعاملات، طرق الدفع، Webhooks، والاسترداد</p>
          </div>
          <button onClick={() => loadAll()} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> تحديث
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="إجمالي المحصّل" value={`${stats.totalCaptured.toFixed(2)} SAR`} icon={TrendingUp} tone="text-emerald-600" />
          <Kpi label="رسوم البوابات" value={`${stats.totalFees.toFixed(2)} SAR`} icon={CreditCard} tone="text-blue-600" />
          <Kpi label="معدل النجاح" value={`${stats.successRate.toFixed(1)}%`} icon={CheckCircle2} tone="text-emerald-600" />
          <Kpi label="عمليات فاشلة" value={String(stats.failed)} icon={AlertTriangle} tone="text-red-600" />
          <Kpi label="مسترد" value={String(stats.refunded)} icon={Undo2} tone="text-purple-600" />
        </div>

        {/* Tabs */}
        <div className="border-b border-border flex gap-1">
          <TabBtn active={tab === "transactions"} onClick={() => setTab("transactions")} icon={CreditCard} label="المعاملات" />
          <TabBtn active={tab === "methods"} onClick={() => setTab("methods")} icon={SettingsIcon} label="طرق الدفع" />
          <TabBtn active={tab === "webhooks"} onClick={() => setTab("webhooks")} icon={Webhook} label="Webhooks" />
        </div>

        {tab === "transactions" && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث برقم الطلب، العميل، Transaction ID..."
                  className="w-full pr-10 pl-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="all">كل الحالات</option>
                <option value="pending">قيد الانتظار</option>
                <option value="authorized">محجوز</option>
                <option value="captured">مكتمل</option>
                <option value="paid">مدفوع</option>
                <option value="failed">فشل</option>
                <option value="refunded">مسترد</option>
                <option value="partially_refunded">مسترد جزئيًا</option>
              </select>
              <select value={gatewayFilter} onChange={(e) => setGatewayFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="all">كل البوابات</option>
                <option value="manual">يدوي</option>
                <option value="stripe">Stripe</option>
                <option value="tap">Tap</option>
                <option value="moyasar">Moyasar</option>
                <option value="hyperpay">HyperPay</option>
                <option value="tabby">Tabby</option>
                <option value="tamara">Tamara</option>
              </select>
              <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                <Download className="h-4 w-4" /> تصدير CSV
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد معاملات</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-right p-3 font-medium">التاريخ</th>
                        <th className="text-right p-3 font-medium">رقم الطلب</th>
                        <th className="text-right p-3 font-medium">العميل</th>
                        <th className="text-right p-3 font-medium">المبلغ</th>
                        <th className="text-right p-3 font-medium">البوابة</th>
                        <th className="text-right p-3 font-medium">Transaction ID</th>
                        <th className="text-right p-3 font-medium">الرسوم</th>
                        <th className="text-right p-3 font-medium">الحالة</th>
                        <th className="text-right p-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => {
                        const lbl = paymentStatusLabel(t.status);
                        return (
                          <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                            <td className="p-3 text-xs whitespace-nowrap">{new Date(t.created_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</td>
                            <td className="p-3 font-mono text-xs">{t.order_number || "—"}</td>
                            <td className="p-3">
                              <div>{t.customer_name || "—"}</div>
                              <div className="text-xs text-muted-foreground">{t.customer_email || ""}</div>
                            </td>
                            <td className="p-3 font-medium">{Number(t.amount).toFixed(2)} {t.currency}</td>
                            <td className="p-3 text-xs">
                              <div>{t.gateway}</div>
                              {t.gateway_method && <div className="text-muted-foreground">{t.gateway_method}</div>}
                            </td>
                            <td className="p-3 font-mono text-xs text-muted-foreground max-w-[140px] truncate">{t.gateway_transaction_id || "—"}</td>
                            <td className="p-3 text-xs text-muted-foreground">{t.gateway_fee ? `${Number(t.gateway_fee).toFixed(2)}` : "—"}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-1 rounded-md text-xs ${lbl.tone}`}>{lbl.ar}</span>
                              {t.webhook_verified && (
                                <Shield className="inline-block h-3 w-3 text-emerald-600 mr-1" />
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <button onClick={() => setSelected(t)} className="p-1.5 rounded hover:bg-muted" title="تفاصيل">
                                  <Eye className="h-4 w-4" />
                                </button>
                                {canManage && (t.status === "captured" || t.status === "paid" || t.status === "partially_refunded") && (
                                  <button onClick={() => { setSelected(t); setRefundOpen(true); }} className="p-1.5 rounded hover:bg-muted text-purple-600" title="استرداد">
                                    <Undo2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "methods" && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-2">
              فعّل/عطّل طرق الدفع المعروضة للعملاء. يدويًا = (دفع عند الاستلام، تحويل بنكي، رابط دفع). البوابات الإلكترونية تحتاج ربط مفاتيح API.
            </div>
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <div className="font-medium">{m.display_name_ar}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.display_name_en} • {m.gateway || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!m.gateway && m.method_key !== "cod" && m.method_key !== "bank_transfer" && m.method_key !== "payment_link" && (
                    <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                      يحتاج ربط بوابة
                    </span>
                  )}
                  <button
                    onClick={() => toggleMethod(m)}
                    disabled={!isAdmin}
                    className={`relative w-12 h-6 rounded-full transition ${m.is_enabled ? "bg-primary" : "bg-muted"} ${!isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className={`absolute top-1 ${m.is_enabled ? "right-1" : "left-1"} w-4 h-4 bg-white rounded-full transition`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "webhooks" && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm">
              <div className="font-medium mb-1">رابط Webhook العام</div>
              <code className="text-xs bg-background px-2 py-1 rounded border border-border block overflow-x-auto">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/public/payment-webhook
              </code>
              <div className="text-xs text-muted-foreground mt-2">
                استخدم هذا الرابط في إعدادات بوابة الدفع. يجب تكوين secret التوقيع عبر متغير البيئة PAYMENT_WEBHOOK_SECRET.
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {webhooks.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">لا توجد سجلات webhook بعد</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-right p-3 font-medium">التاريخ</th>
                        <th className="text-right p-3 font-medium">البوابة</th>
                        <th className="text-right p-3 font-medium">النوع</th>
                        <th className="text-right p-3 font-medium">التوقيع</th>
                        <th className="text-right p-3 font-medium">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhooks.map((w) => (
                        <tr key={w.id} className="border-t border-border">
                          <td className="p-3 text-xs">{new Date(w.created_at).toLocaleString("ar")}</td>
                          <td className="p-3">{w.gateway}</td>
                          <td className="p-3 text-xs font-mono">{w.event_type || "—"}</td>
                          <td className="p-3">
                            {w.signature_valid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" /> صحيح</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 text-xs"><XCircle className="h-3 w-3" /> غير صحيح</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-1 rounded ${w.processed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                              {w.processed ? "تم المعالجة" : "بانتظار"}
                            </span>
                            {w.processing_error && <div className="text-xs text-red-600 mt-1">{w.processing_error}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selected && !refundOpen && (
        <TxnDrawer txn={selected} onClose={() => setSelected(null)} onRefund={() => setRefundOpen(true)} canManage={canManage} />
      )}
      {selected && refundOpen && (
        <RefundDialog txn={selected} onClose={() => { setRefundOpen(false); setSelected(null); }} onConfirm={performRefund} />
      )}
    </AdminShell>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function TxnDrawer({ txn, onClose, onRefund, canManage }: any) {
  const lbl = paymentStatusLabel(txn.status);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-background overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <div>
            <span className={`inline-block px-2 py-1 rounded-md text-xs ${lbl.tone}`}>{lbl.ar}</span>
            <h2 className="text-xl font-bold mt-2">معاملة دفع</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-muted"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <Field label="رقم الطلب" value={txn.order_number || "—"} mono />
          <Field label="العميل" value={`${txn.customer_name || ""} ${txn.customer_email ? `(${txn.customer_email})` : ""}`} />
          <Field label="المبلغ" value={`${Number(txn.amount).toFixed(2)} ${txn.currency}`} />
          <Field label="البوابة" value={`${txn.gateway} ${txn.gateway_method ? `• ${txn.gateway_method}` : ""}`} />
          <Field label="Transaction ID" value={txn.gateway_transaction_id || "—"} mono />
          <Field label="رسوم البوابة" value={txn.gateway_fee ? `${Number(txn.gateway_fee).toFixed(2)} ${txn.currency}` : "—"} />
          {txn.card_last4 && <Field label="آخر 4 أرقام" value={`**** ${txn.card_last4} (${txn.card_brand || "card"})`} />}
          <Field label="التوقيع موثق" value={txn.webhook_verified ? "نعم ✓" : "لا"} />
          <Field label="تاريخ الإنشاء" value={new Date(txn.created_at).toLocaleString("ar")} />
          {txn.captured_at && <Field label="تاريخ التأكيد" value={new Date(txn.captured_at).toLocaleString("ar")} />}
          {txn.error_message && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <div className="text-xs font-semibold text-red-800 dark:text-red-300">رسالة الخطأ من البوابة</div>
              <div className="text-xs text-red-700 dark:text-red-400 mt-1">{txn.error_code && `[${txn.error_code}] `}{txn.error_message}</div>
            </div>
          )}
          {txn.raw_response && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">عرض الاستجابة الخام</summary>
              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">{JSON.stringify(txn.raw_response, null, 2)}</pre>
            </details>
          )}
          {canManage && (txn.status === "captured" || txn.status === "paid" || txn.status === "partially_refunded") && (
            <button onClick={onRefund} className="w-full mt-4 p-3 rounded-lg bg-purple-600 text-white flex items-center justify-center gap-2 hover:opacity-90">
              <Undo2 className="h-4 w-4" /> إجراء استرداد
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

function RefundDialog({ txn, onClose, onConfirm }: any) {
  const [amount, setAmount] = useState(Number(txn.amount));
  const [reason, setReason] = useState("");
  const [partial, setPartial] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">إجراء استرداد</h2>
        <div className="text-sm text-muted-foreground">
          المبلغ الأصلي: <span className="font-bold text-foreground">{Number(txn.amount).toFixed(2)} {txn.currency}</span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={partial} onChange={(e) => { setPartial(e.target.checked); if (!e.target.checked) setAmount(Number(txn.amount)); }} />
          استرداد جزئي
        </label>
        {partial && (
          <div>
            <label className="text-xs text-muted-foreground">المبلغ المراد استرداده</label>
            <input
              type="number"
              step="0.01"
              max={Number(txn.amount)}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">سبب الاسترداد</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
            placeholder="مثال: العميل طلب الإلغاء، منتج تالف..."
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 p-2 rounded-lg border border-border text-sm">إلغاء</button>
          <button
            onClick={() => onConfirm(amount, reason)}
            disabled={!reason || amount <= 0 || amount > Number(txn.amount)}
            className="flex-1 p-2 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-50"
          >
            تأكيد الاسترداد
          </button>
        </div>
      </div>
    </div>
  );
}
