import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StateBoundary } from "@/components/states/StateViews";
import { toast } from "sonner";

const ALL_EVENTS = [
  "order.created",
  "order.paid",
  "order.cancelled",
  "order.shipped",
  "order.delivered",
  "payment.succeeded",
  "payment.failed",
  "shipment.created",
  "shipment.updated",
  "inventory.low",
  "customer.created",
  "cart.abandoned",
];

export const Route = createFileRoute("/admin/webhooks")({
  component: WebhooksAdminPage,
});

function WebhooksAdminPage() {
  const [endpoints, setEndpoints] = useState<any[] | null>(null);
  const [deliveries, setDeliveries] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });

  async function load() {
    setError(null);
    const [e, d] = await Promise.all([
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }),
      supabase
        .from("webhook_deliveries")
        .select("id,event_type,status,http_status,attempt,error_message,created_at,delivered_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (e.error) setError(e.error.message);
    setEndpoints(e.data ?? []);
    setDeliveries(d.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function createEndpoint() {
    if (!form.name || !form.url || form.events.length === 0) {
      toast.error("اكمل الاسم، الرابط، واختر حدثًا واحدًا على الأقل");
      return;
    }
    setCreating(true);
    const secret =
      "whsec_" +
      Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const { error } = await supabase
      .from("webhook_endpoints")
      .insert({ name: form.name, url: form.url, events: form.events, secret, enabled: true });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم. السر الموقّع: " + secret);
    setForm({ name: "", url: "", events: [] });
    load();
  }

  async function toggle(id: string, enabled: boolean) {
    await supabase.from("webhook_endpoints").update({ enabled: !enabled }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الـ endpoint؟")) return;
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    load();
  }

  return (
    <AdminShell>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks وAPI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة عناوين الـ Webhook، مراقبة عمليات التسليم، ومفاتيح API الخارجية.
          </p>
        </div>

        {/* Create endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">إضافة Endpoint جديد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>الاسم</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My CRM Webhook"
                />
              </div>
              <div>
                <Label>الرابط (URL)</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://example.com/webhooks"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label>الأحداث</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ALL_EVENTS.map((ev) => {
                  const on = form.events.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          events: on
                            ? form.events.filter((e) => e !== ev)
                            : [...form.events, ev],
                        })
                      }
                      className={`text-xs px-2 py-1 rounded border ${
                        on ? "bg-primary text-primary-foreground" : "bg-background"
                      }`}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={createEndpoint} disabled={creating}>
              {creating ? "جاري الحفظ…" : "إنشاء"}
            </Button>
          </CardContent>
        </Card>

        {/* Endpoints list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">العناوين المسجّلة</CardTitle>
          </CardHeader>
          <CardContent>
            <StateBoundary
              loading={endpoints === null}
              error={error}
              isEmpty={endpoints?.length === 0}
              emptyTitle="لا توجد endpoints بعد"
              emptyDescription="أضف أول endpoint من الأعلى"
              loadingVariant="table"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الرابط</TableHead>
                      <TableHead>الأحداث</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الفشل المتتالي</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints?.map((ep) => (
                      <TableRow key={ep.id}>
                        <TableCell className="font-medium">{ep.name}</TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[200px]">
                          {ep.url}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {ep.events?.slice(0, 3).map((e: string) => (
                              <Badge key={e} variant="secondary" className="text-[10px]">
                                {e}
                              </Badge>
                            ))}
                            {ep.events?.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{ep.events.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ep.enabled ? "default" : "outline"}>
                            {ep.enabled ? "نشط" : "متوقف"}
                          </Badge>
                        </TableCell>
                        <TableCell>{ep.failure_count ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggle(ep.id, ep.enabled)}
                          >
                            {ep.enabled ? "إيقاف" : "تشغيل"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => remove(ep.id)}
                          >
                            حذف
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </StateBoundary>
          </CardContent>
        </Card>

        {/* Deliveries log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر 50 محاولة تسليم</CardTitle>
          </CardHeader>
          <CardContent>
            <StateBoundary
              loading={deliveries === null}
              isEmpty={deliveries?.length === 0}
              emptyTitle="لا يوجد سجل تسليم بعد"
              loadingVariant="table"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحدث</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>المحاولة</TableHead>
                      <TableHead>الخطأ</TableHead>
                      <TableHead>الوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries?.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              d.status === "success"
                                ? "default"
                                : d.status === "dead"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{d.http_status ?? "—"}</TableCell>
                        <TableCell>{d.attempt}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {d.error_message ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleString("ar")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </StateBoundary>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
