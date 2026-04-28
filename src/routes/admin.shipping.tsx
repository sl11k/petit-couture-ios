import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/state/AuthContext";
import { toast } from "sonner";
import { addTrackingEvent, createShipment, shipmentStatusLabel, type ShipmentStatus } from "@/lib/shipping";
import {
  Truck, Search, RefreshCw, Plus, Settings as SettingsIcon, MapPin, Package,
  Printer, Eye, AlertTriangle, Webhook, CheckCircle2, XCircle, Edit3, Trash2,
} from "lucide-react";

export const Route = createFileRoute("/admin/shipping")({ component: ShippingPage });

function ShippingPage() {
  const { user } = useAuth();
  const { canManage, isAdmin } = useUserRole();
  const [tab, setTab] = useState<"shipments" | "carriers" | "zones" | "rates" | "webhooks">("shipments");
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [sh, c, z, r, w] = await Promise.all([
      supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("shipping_carriers").select("*").order("display_order"),
      supabase.from("shipping_zones").select("*").order("name_ar"),
      supabase.from("shipping_rates").select("*"),
      supabase.from("shipping_webhooks_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setShipments(sh.data || []); setCarriers(c.data || []); setZones(z.data || []);
    setRates(r.data || []); setWebhooks(w.data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (carrierFilter !== "all" && s.carrier_id !== carrierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (s.tracking_number || "").toLowerCase().includes(q) ||
          (s.order_number || "").toLowerCase().includes(q) ||
          (s.customer_name || "").toLowerCase().includes(q) ||
          (s.customer_phone || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [shipments, statusFilter, carrierFilter, search]);

  const stats = useMemo(() => {
    const delivered = shipments.filter((s) => s.status === "delivered").length;
    const inTransit = shipments.filter((s) => ["picked_up", "in_transit", "out_for_delivery"].includes(s.status)).length;
    const failed = shipments.filter((s) => ["failed_delivery", "returned", "lost"].includes(s.status)).length;
    const delayed = shipments.filter((s) => {
      if (s.status === "delivered" || s.status === "cancelled") return false;
      const created = new Date(s.created_at).getTime();
      return Date.now() - created > 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { total: shipments.length, delivered, inTransit, failed, delayed };
  }, [shipments]);

  async function changeCarrier(shipmentId: string, newCarrierId: string) {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    const newCarrier = carriers.find((c) => c.id === newCarrierId);
    const { error } = await supabase
      .from("shipments")
      .update({ carrier_id: newCarrierId, carrier_code: newCarrier?.code, status: "label_created" })
      .eq("id", shipmentId);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      action: "shipment_carrier_changed", entity: "shipment", entity_id: shipmentId,
      actor_id: user?.id, actor_email: user?.email,
      metadata: { new_carrier: newCarrier?.code },
    });
    toast.success("تم تغيير شركة الشحن");
    void loadAll();
  }

  async function manualUpdateStatus(shipmentId: string, status: ShipmentStatus, description?: string) {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    await addTrackingEvent(shipmentId, status, description, undefined, "manual");
    await supabase.from("audit_logs").insert({
      action: "shipment_status_updated", entity: "shipment", entity_id: shipmentId,
      actor_id: user?.id, actor_email: user?.email, metadata: { status, description },
    });
    toast.success("تم التحديث");
    void loadAll();
    if (selected?.id === shipmentId) {
      const { data } = await supabase.from("shipments").select("*").eq("id", shipmentId).single();
      setSelected(data);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">الشحن</h1>
            <p className="text-sm text-muted-foreground">إدارة الشحنات، شركات الشحن، المناطق، والتسعير</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadAll()} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <RefreshCw className="h-4 w-4" /> تحديث
            </button>
            {canManage && (
              <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                <Plus className="h-4 w-4" /> شحنة جديدة
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="إجمالي" value={String(stats.total)} icon={Package} tone="text-blue-600" />
          <Kpi label="قيد النقل" value={String(stats.inTransit)} icon={Truck} tone="text-indigo-600" />
          <Kpi label="تم التسليم" value={String(stats.delivered)} icon={CheckCircle2} tone="text-emerald-600" />
          <Kpi label="فشل/مرتجع" value={String(stats.failed)} icon={AlertTriangle} tone="text-red-600" />
          <Kpi label="متأخرة (>7 أيام)" value={String(stats.delayed)} icon={AlertTriangle} tone="text-amber-600" />
        </div>

        <div className="border-b border-border flex gap-1 overflow-x-auto">
          <TabBtn active={tab === "shipments"} onClick={() => setTab("shipments")} icon={Package} label="الشحنات" />
          <TabBtn active={tab === "carriers"} onClick={() => setTab("carriers")} icon={Truck} label="الشركات" />
          <TabBtn active={tab === "zones"} onClick={() => setTab("zones")} icon={MapPin} label="المناطق" />
          <TabBtn active={tab === "rates"} onClick={() => setTab("rates")} icon={SettingsIcon} label="التسعير" />
          <TabBtn active={tab === "webhooks"} onClick={() => setTab("webhooks")} icon={Webhook} label="Webhooks" />
        </div>

        {tab === "shipments" && (
          <>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث برقم التتبع، الطلب، العميل..."
                  className="w-full pr-10 pl-3 py-2 rounded-lg border border-border bg-background text-sm" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="all">كل الحالات</option>
                {["pending","label_created","picked_up","in_transit","out_for_delivery","delivered","failed_delivery","returned","lost","cancelled"].map(s => (
                  <option key={s} value={s}>{shipmentStatusLabel(s).ar}</option>
                ))}
              </select>
              <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="all">كل الشركات</option>
                {carriers.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
              : filtered.length === 0 ? <div className="p-12 text-center text-muted-foreground">لا توجد شحنات</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-right p-3 font-medium">التاريخ</th>
                        <th className="text-right p-3 font-medium">الطلب</th>
                        <th className="text-right p-3 font-medium">العميل</th>
                        <th className="text-right p-3 font-medium">المدينة</th>
                        <th className="text-right p-3 font-medium">الشركة</th>
                        <th className="text-right p-3 font-medium">رقم التتبع</th>
                        <th className="text-right p-3 font-medium">الحالة</th>
                        <th className="text-right p-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const lbl = shipmentStatusLabel(s.status);
                        const carrier = carriers.find((c) => c.id === s.carrier_id);
                        return (
                          <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                            <td className="p-3 text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("ar")}</td>
                            <td className="p-3 font-mono text-xs">{s.order_number || "—"}</td>
                            <td className="p-3">
                              <div>{s.customer_name}</div>
                              <div className="text-xs text-muted-foreground">{s.customer_phone}</div>
                            </td>
                            <td className="p-3 text-xs">{s.city || "—"}</td>
                            <td className="p-3 text-xs">{carrier?.name_ar || s.carrier_code || "—"}</td>
                            <td className="p-3 font-mono text-xs">{s.tracking_number || "—"}</td>
                            <td className="p-3"><span className={`inline-block px-2 py-1 rounded-md text-xs ${lbl.tone}`}>{lbl.ar}</span></td>
                            <td className="p-3">
                              <button onClick={() => setSelected(s)} className="p-1.5 rounded hover:bg-muted" title="تفاصيل">
                                <Eye className="h-4 w-4" />
                              </button>
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

        {tab === "carriers" && (
          <CarriersTab carriers={carriers} reload={loadAll} canManage={canManage} />
        )}
        {tab === "zones" && (
          <ZonesTab zones={zones} carriers={carriers} reload={loadAll} canManage={canManage} />
        )}
        {tab === "rates" && (
          <RatesTab rates={rates} zones={zones} carriers={carriers} reload={loadAll} canManage={canManage} />
        )}
        {tab === "webhooks" && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg border border-border bg-muted/30 text-sm">
              <div className="font-medium mb-1">رابط Webhook الشحن</div>
              <code className="text-xs bg-background px-2 py-1 rounded border border-border block overflow-x-auto">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/public/shipping-webhook
              </code>
              <div className="text-xs text-muted-foreground mt-2">
                استخدم هذا الرابط في إعدادات شركة الشحن. يحتاج توقيع HMAC عبر متغير SHIPPING_WEBHOOK_SECRET.
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {webhooks.length === 0 ? <div className="p-12 text-center text-muted-foreground">لا توجد سجلات</div>
              : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-right p-3 font-medium">التاريخ</th>
                      <th className="text-right p-3 font-medium">الشركة</th>
                      <th className="text-right p-3 font-medium">الحدث</th>
                      <th className="text-right p-3 font-medium">التوقيع</th>
                      <th className="text-right p-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((w) => (
                      <tr key={w.id} className="border-t border-border">
                        <td className="p-3 text-xs">{new Date(w.created_at).toLocaleString("ar")}</td>
                        <td className="p-3">{w.carrier_code}</td>
                        <td className="p-3 text-xs font-mono">{w.event_type || "—"}</td>
                        <td className="p-3">{w.signature_valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}</td>
                        <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${w.processed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{w.processed ? "تمت المعالجة" : "بانتظار"}</span>{w.processing_error && <div className="text-xs text-red-600 mt-1">{w.processing_error}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {selected && <ShipmentDrawer shipment={selected} carriers={carriers} onClose={() => setSelected(null)} canManage={canManage} onChangeCarrier={changeCarrier} onUpdateStatus={manualUpdateStatus} />}
      {createOpen && <CreateShipmentDialog carriers={carriers} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); loadAll(); }} userId={user?.id} />}
    </AdminShell>
  );
}

function Kpi({ label, value, icon: Icon, tone }: any) {
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
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 whitespace-nowrap ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function CarriersTab({ carriers, reload, canManage }: any) {
  async function toggle(c: any) {
    if (!canManage) return toast.error("لا تملك الصلاحية");
    await supabase.from("shipping_carriers").update({ is_active: !c.is_active }).eq("id", c.id);
    toast.success(c.is_active ? "تم التعطيل" : "تم التفعيل");
    reload();
  }
  return (
    <div className="space-y-2">
      {carriers.map((c: any) => (
        <div key={c.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
          <div>
            <div className="font-medium">{c.name_ar}</div>
            <div className="text-xs text-muted-foreground">
              {c.name_en} • {c.carrier_type} • {c.supports_cod ? "يدعم COD ✓" : "لا يدعم COD"} • {c.supports_international ? "دولي ✓" : "محلي"} • {c.default_delivery_days_min}-{c.default_delivery_days_max} يوم
            </div>
          </div>
          <button onClick={() => toggle(c)} disabled={!canManage} className={`relative w-12 h-6 rounded-full transition ${c.is_active ? "bg-primary" : "bg-muted"} ${!canManage ? "opacity-50" : ""}`}>
            <span className={`absolute top-1 ${c.is_active ? "right-1" : "left-1"} w-4 h-4 bg-white rounded-full transition`} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ZonesTab({ zones, carriers, reload, canManage }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ carrier_id: "", name_ar: "", name_en: "", country_code: "SA", cities: "", delivery_days_min: 1, delivery_days_max: 5 });

  async function save() {
    if (!canManage) return;
    const cities = form.cities.split(",").map((c: string) => c.trim()).filter(Boolean);
    const { error } = await supabase.from("shipping_zones").insert({ ...form, cities });
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة");
    setOpen(false); setForm({ carrier_id: "", name_ar: "", name_en: "", country_code: "SA", cities: "", delivery_days_min: 1, delivery_days_max: 5 });
    reload();
  }
  async function del(id: string) {
    if (!canManage || !confirm("حذف المنطقة؟")) return;
    await supabase.from("shipping_zones").delete().eq("id", id);
    reload();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> منطقة جديدة
        </button>
      )}
      <div className="space-y-2">
        {zones.map((z: any) => {
          const carrier = carriers.find((c: any) => c.id === z.carrier_id);
          return (
            <div key={z.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div>
                <div className="font-medium">{z.name_ar} <span className="text-xs text-muted-foreground">({carrier?.name_ar || "—"})</span></div>
                <div className="text-xs text-muted-foreground">
                  {z.country_code} • {(z.cities || []).length === 0 ? "كل المدن" : (z.cities || []).join("، ")} • {z.delivery_days_min}-{z.delivery_days_max} يوم
                </div>
              </div>
              {canManage && <button onClick={() => del(z.id)} className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 className="h-4 w-4" /></button>}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-background rounded-xl p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">منطقة شحن جديدة</h2>
            <select value={form.carrier_id} onChange={(e) => setForm({ ...form, carrier_id: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm">
              <option value="">— شركة الشحن —</option>
              {carriers.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
            <input placeholder="الاسم بالعربية" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <input placeholder="Name (English)" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <input placeholder="رمز الدولة (SA)" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <textarea placeholder="المدن مفصولة بفواصل (الرياض، جدة، الدمام). اتركها فارغة لتغطية كل المدن" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} rows={3} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="أقل عدد أيام" value={form.delivery_days_min} onChange={(e) => setForm({ ...form, delivery_days_min: Number(e.target.value) })} className="w-full p-2 rounded border border-border bg-background text-sm" />
              <input type="number" placeholder="أكثر عدد أيام" value={form.delivery_days_max} onChange={(e) => setForm({ ...form, delivery_days_max: Number(e.target.value) })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 p-2 rounded border border-border text-sm">إلغاء</button>
              <button onClick={save} disabled={!form.carrier_id || !form.name_ar} className="flex-1 p-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RatesTab({ rates, zones, carriers, reload, canManage }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ zone_id: "", rate_type: "flat", base_fee: 25, per_kg_fee: 0, free_shipping_threshold: "", cod_extra_fee: 0, max_weight_kg: "" });

  async function save() {
    if (!canManage) return;
    const zone = zones.find((z: any) => z.id === form.zone_id);
    const payload: any = {
      zone_id: form.zone_id,
      carrier_id: zone?.carrier_id,
      rate_type: form.rate_type,
      base_fee: Number(form.base_fee || 0),
      per_kg_fee: Number(form.per_kg_fee || 0),
      cod_extra_fee: Number(form.cod_extra_fee || 0),
    };
    if (form.free_shipping_threshold) payload.free_shipping_threshold = Number(form.free_shipping_threshold);
    if (form.max_weight_kg) payload.max_weight_kg = Number(form.max_weight_kg);

    const { error } = await supabase.from("shipping_rates").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة");
    setOpen(false);
    reload();
  }
  async function del(id: string) {
    if (!canManage || !confirm("حذف القاعدة؟")) return;
    await supabase.from("shipping_rates").delete().eq("id", id);
    reload();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> قاعدة تسعير جديدة
        </button>
      )}
      <div className="space-y-2">
        {rates.map((r: any) => {
          const zone = zones.find((z: any) => z.id === r.zone_id);
          const carrier = carriers.find((c: any) => c.id === r.carrier_id);
          return (
            <div key={r.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{carrier?.name_ar} → {zone?.name_ar}</div>
                <div className="text-xs text-muted-foreground">
                  {r.rate_type} • {r.base_fee} SAR{r.rate_type === "weight" ? ` + ${r.per_kg_fee}/kg` : ""}
                  {r.free_shipping_threshold && ` • شحن مجاني ≥ ${r.free_shipping_threshold}`}
                  {r.cod_extra_fee > 0 && ` • COD +${r.cod_extra_fee}`}
                  {r.max_weight_kg && ` • حد ${r.max_weight_kg}kg`}
                </div>
              </div>
              {canManage && <button onClick={() => del(r.id)} className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 className="h-4 w-4" /></button>}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-background rounded-xl p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">قاعدة تسعير جديدة</h2>
            <select value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm">
              <option value="">— المنطقة —</option>
              {zones.map((z: any) => {
                const c = carriers.find((cc: any) => cc.id === z.carrier_id);
                return <option key={z.id} value={z.id}>{c?.name_ar} - {z.name_ar}</option>;
              })}
            </select>
            <select value={form.rate_type} onChange={(e) => setForm({ ...form, rate_type: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm">
              <option value="flat">سعر ثابت</option>
              <option value="weight">حسب الوزن</option>
              <option value="value">حسب قيمة الطلب</option>
            </select>
            <input type="number" placeholder="السعر الأساسي (SAR)" value={form.base_fee} onChange={(e) => setForm({ ...form, base_fee: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            {form.rate_type === "weight" && (
              <input type="number" placeholder="سعر لكل كيلو" value={form.per_kg_fee} onChange={(e) => setForm({ ...form, per_kg_fee: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            )}
            <input type="number" placeholder="حد الشحن المجاني (اختياري)" value={form.free_shipping_threshold} onChange={(e) => setForm({ ...form, free_shipping_threshold: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <input type="number" placeholder="رسوم COD إضافية (اختياري)" value={form.cod_extra_fee} onChange={(e) => setForm({ ...form, cod_extra_fee: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <input type="number" placeholder="حد أقصى للوزن kg (اختياري)" value={form.max_weight_kg} onChange={(e) => setForm({ ...form, max_weight_kg: e.target.value })} className="w-full p-2 rounded border border-border bg-background text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 p-2 rounded border border-border text-sm">إلغاء</button>
              <button onClick={save} disabled={!form.zone_id} className="flex-1 p-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShipmentDrawer({ shipment, carriers, onClose, canManage, onChangeCarrier, onUpdateStatus }: any) {
  const lbl = shipmentStatusLabel(shipment.status);
  const [events, setEvents] = useState<any[]>([]);
  const [newStatus, setNewStatus] = useState<ShipmentStatus>("in_transit");
  const [statusDesc, setStatusDesc] = useState("");

  useEffect(() => {
    void supabase.from("shipment_tracking_events").select("*").eq("shipment_id", shipment.id).order("occurred_at", { ascending: false }).then(({ data }) => setEvents(data || []));
  }, [shipment.id]);

  function printAWB() {
    const w = window.open("", "_blank");
    if (!w) return;
    const carrier = carriers.find((c: any) => c.id === shipment.carrier_id);
    w.document.write(`<!doctype html><html dir="rtl"><head><title>بوليصة ${shipment.tracking_number}</title>
      <style>body{font-family:Arial;padding:24px}h1{font-size:20px}.box{border:2px solid #000;padding:16px;margin:8px 0}.row{display:flex;justify-content:space-between;margin:6px 0}.lbl{color:#666;font-size:12px}.val{font-weight:bold}</style></head><body>
      <h1>بوليصة شحن — ${carrier?.name_ar || ""}</h1>
      <div class="box">
        <div class="row"><span class="lbl">رقم التتبع</span><span class="val" style="font-size:24px">${shipment.tracking_number || "—"}</span></div>
        <div class="row"><span class="lbl">رقم الطلب</span><span class="val">${shipment.order_number || "—"}</span></div>
      </div>
      <div class="box">
        <div class="lbl">المرسل إليه</div>
        <div class="val">${shipment.customer_name}</div>
        <div>${shipment.customer_phone}</div>
        <div>${JSON.stringify(shipment.shipping_address)}</div>
        <div>${shipment.city || ""}, ${shipment.country_code}</div>
      </div>
      <div class="box">
        <div class="row"><span class="lbl">الوزن</span><span>${shipment.weight_kg || "—"} kg</span></div>
        <div class="row"><span class="lbl">قيمة COD</span><span>${shipment.cod_amount || 0} SAR</span></div>
        <div class="row"><span class="lbl">رسوم الشحن</span><span>${shipment.shipping_fee || 0} SAR</span></div>
      </div>
      <script>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-background overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <div>
            <span className={`inline-block px-2 py-1 rounded-md text-xs ${lbl.tone}`}>{lbl.ar}</span>
            <h2 className="text-xl font-bold mt-2">شحنة #{shipment.tracking_number}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-muted"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <button onClick={printAWB} className="w-full p-2 rounded-lg border border-border flex items-center justify-center gap-2 hover:bg-muted">
            <Printer className="h-4 w-4" /> طباعة البوليصة
          </button>

          <div className="space-y-2">
            <Field label="رقم الطلب" value={shipment.order_number || "—"} />
            <Field label="العميل" value={`${shipment.customer_name} • ${shipment.customer_phone}`} />
            <Field label="المدينة" value={shipment.city || "—"} />
            <Field label="الوزن" value={shipment.weight_kg ? `${shipment.weight_kg} kg` : "—"} />
            <Field label="قيمة COD" value={shipment.cod_amount ? `${shipment.cod_amount} SAR` : "—"} />
            <Field label="رسوم الشحن" value={`${shipment.shipping_fee || 0} SAR`} />
            {shipment.failure_reason && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs">سبب الفشل: {shipment.failure_reason}</div>
            )}
          </div>

          {canManage && (
            <div className="p-3 rounded-lg border border-border space-y-2">
              <div className="font-medium text-sm">تغيير شركة الشحن</div>
              <select onChange={(e) => e.target.value && onChangeCarrier(shipment.id, e.target.value)} value={shipment.carrier_id || ""} className="w-full p-2 rounded border border-border bg-background text-sm">
                {carriers.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
          )}

          {canManage && (
            <div className="p-3 rounded-lg border border-border space-y-2">
              <div className="font-medium text-sm">تحديث الحالة يدويًا</div>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ShipmentStatus)} className="w-full p-2 rounded border border-border bg-background text-sm">
                {["picked_up","in_transit","out_for_delivery","delivered","failed_delivery","returned","lost","cancelled"].map(s => (
                  <option key={s} value={s}>{shipmentStatusLabel(s).ar}</option>
                ))}
              </select>
              <input value={statusDesc} onChange={(e) => setStatusDesc(e.target.value)} placeholder="ملاحظة (اختياري)" className="w-full p-2 rounded border border-border bg-background text-sm" />
              <button onClick={() => { onUpdateStatus(shipment.id, newStatus, statusDesc); setStatusDesc(""); }} className="w-full p-2 rounded bg-primary text-primary-foreground text-sm">تحديث</button>
            </div>
          )}

          <div>
            <div className="font-medium text-sm mb-2">سجل التتبع</div>
            <div className="space-y-2">
              {events.length === 0 ? <div className="text-xs text-muted-foreground">لا أحداث بعد</div>
              : events.map((e) => {
                const l = shipmentStatusLabel(e.status);
                return (
                  <div key={e.id} className="p-2 rounded border border-border text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded ${l.tone}`}>{l.ar}</span>
                      <span className="text-muted-foreground">{new Date(e.occurred_at).toLocaleString("ar")}</span>
                    </div>
                    {e.description && <div className="mt-1">{e.description}</div>}
                    {e.location && <div className="text-muted-foreground">📍 {e.location}</div>}
                    <div className="text-muted-foreground text-[10px] mt-1">{e.source}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: any) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function CreateShipmentDialog({ carriers, onClose, onCreated, userId }: any) {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<any | null>(null);
  const [carrierId, setCarrierId] = useState("");
  const [weight, setWeight] = useState(1);

  async function findOrder() {
    const { data } = await supabase.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
    if (!data) return toast.error("الطلب غير موجود");
    setOrder(data);
  }

  async function create() {
    if (!order || !carrierId) return;
    const { error } = await createShipment({
      order_id: order.id,
      carrier_id: carrierId,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      shipping_address: order.shipping_address || {},
      city: (order.shipping_address as any)?.city,
      lat: order.shipping_lat,
      lng: order.shipping_lng,
      weight_kg: weight,
      cod_amount: order.payment_method === "cod" ? Number(order.total) : 0,
      shipping_fee: Number(order.shipping_fee || 0),
      created_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء الشحنة");
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-xl p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">شحنة جديدة</h2>
        <div className="flex gap-2">
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="رقم الطلب (MN-...)" className="flex-1 p-2 rounded border border-border bg-background text-sm" />
          <button onClick={findOrder} className="px-3 rounded bg-muted text-sm">بحث</button>
        </div>
        {order && (
          <>
            <div className="p-3 rounded bg-muted/50 text-xs space-y-1">
              <div><b>{order.customer_name}</b> • {order.customer_phone}</div>
              <div>{(order.shipping_address as any)?.city || "—"}</div>
              <div>الإجمالي: {order.total} SAR • {order.payment_method === "cod" ? "دفع عند الاستلام ✓" : "مدفوع"}</div>
            </div>
            <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} className="w-full p-2 rounded border border-border bg-background text-sm">
              <option value="">— شركة الشحن —</option>
              {carriers.filter((c: any) => c.is_active).map((c: any) => (
                <option key={c.id} value={c.id} disabled={order.payment_method === "cod" && !c.supports_cod}>
                  {c.name_ar} {order.payment_method === "cod" && !c.supports_cod ? "(لا يدعم COD)" : ""}
                </option>
              ))}
            </select>
            <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} placeholder="الوزن (kg)" className="w-full p-2 rounded border border-border bg-background text-sm" />
          </>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 p-2 rounded border border-border text-sm">إلغاء</button>
          <button onClick={create} disabled={!order || !carrierId} className="flex-1 p-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50">إنشاء</button>
        </div>
      </div>
    </div>
  );
}
