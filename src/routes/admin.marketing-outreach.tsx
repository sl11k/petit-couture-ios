import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, Users, RefreshCw, Send, CheckCircle2, XCircle, Plug, ListPlus, ShieldCheck,
} from "lucide-react";
import {
  previewAudience, generateAudience, syncAudienceToProvider,
  marketingProviderStatus, reviewCampaignRequest, sendCampaignRequest,
} from "@/lib/marketing.functions";

type Audience = {
  id: string; name: string; description: string | null; filters: any;
  member_count: number; provider: string | null; provider_list_id: string | null;
  synced_at: string | null; last_generated_at: string | null; created_at: string;
};

type CampaignRequest = {
  id: string; title: string; objective: string | null; channel: string;
  audience_id: string | null; coupon_code: string | null; email_subject: string | null;
  email_body: string | null; scheduled_at: string | null; status: string;
  provider_campaign_id: string | null; sent_at: string | null; sent_count: number;
  rejection_reason: string | null; created_at: string;
};

const STATUS: Record<string, { ar: string; cls: string }> = {
  draft: { ar: "مسودة", cls: "bg-muted text-muted-foreground" },
  pending_review: { ar: "بانتظار الموافقة", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { ar: "معتمد", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  rejected: { ar: "مرفوض", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  scheduled: { ar: "مجدول", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  sent: { ar: "تم الإرسال", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

function statusBadge(s: string) {
  const st = STATUS[s] ?? { ar: s, cls: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${st.cls}`}>{st.ar}</span>;
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleString("ar-SA") : "—";
}

function errMsg(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e);
  if (raw.includes("BREVO_NOT_CONNECTED")) return "خدمة التسويق البريدي غير مربوطة بعد";
  if (raw.includes("AUDIENCE_NOT_SYNCED")) return "لم تتم مزامنة القائمة مع مزود التسويق";
  if (raw.includes("EMPTY_AUDIENCE")) return "القائمة فارغة، ولّدها أولاً";
  if (raw.includes("NOT_APPROVED")) return "الطلب غير معتمد بعد";
  if (raw.includes("ALREADY_SENT")) return "تم إرسال هذه الحملة مسبقاً";
  if (raw.includes("MISSING_CONTENT")) return "أكمل عنوان ونص الرسالة";
  if (raw.includes("NO_AUDIENCE")) return "اختر قائمة عملاء للحملة";
  if (raw.includes("FORBIDDEN")) return "لا تملك صلاحية هذا الإجراء";
  return raw;
}

/* --------------------------------------------------------------- audiences */

function AudiencesTab() {
  const qc = useQueryClient();
  const preview = useServerFn(previewAudience);
  const generate = useServerFn(generateAudience);
  const sync = useServerFn(syncAudienceToProvider);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [onlyBuyers, setOnlyBuyers] = useState(true);
  const [minOrders, setMinOrders] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [days, setDays] = useState("");
  const [city, setCity] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filters = useMemo(() => ({
    onlyBuyers,
    minOrders: minOrders ? Number(minOrders) : undefined,
    minSpent: minSpent ? Number(minSpent) : undefined,
    lastOrderWithinDays: days ? Number(days) : undefined,
    city: city.trim() || undefined,
  }), [onlyBuyers, minOrders, minSpent, days, city]);

  const { data: audiences, isLoading } = useQuery({
    queryKey: ["campaign-audiences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaign_audiences").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Audience[];
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListPlus className="h-4 w-4" /> توليد قائمة عملاء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="mb-0.5 inline h-3.5 w-3.5" /> تُدرج فقط الحسابات التي وافقت صراحةً على الرسائل التسويقية،
            وتُستبعد العناوين الموقوفة (ارتداد/شكوى/إلغاء اشتراك).
          </div>
          <div>
            <Label>اسم القائمة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="عملاء مميزون" />
          </div>
          <div>
            <Label>الوصف</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="اختياري" />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <Label className="text-xs">المشترون فقط</Label>
            <Switch checked={onlyBuyers} onCheckedChange={setOnlyBuyers} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">أقل عدد طلبات</Label><Input type="number" min={0} value={minOrders} onChange={(e) => setMinOrders(e.target.value)} /></div>
            <div><Label className="text-xs">أقل إنفاق</Label><Input type="number" min={0} value={minSpent} onChange={(e) => setMinSpent(e.target.value)} /></div>
            <div><Label className="text-xs">آخر طلب خلال (يوم)</Label><Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></div>
            <div><Label className="text-xs">المدينة</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline" className="flex-1" disabled={busy === "preview"}
              onClick={async () => {
                setBusy("preview");
                try { setPreviewData(await preview({ data: filters })); }
                catch (e) { toast.error(errMsg(e)); }
                finally { setBusy(null); }
              }}
            >
              معاينة العدد
            </Button>
            <Button
              className="flex-1" disabled={busy === "gen" || name.trim().length < 2}
              onClick={async () => {
                setBusy("gen");
                try {
                  const res = await generate({ data: { name: name.trim(), description: description.trim() || null, filters } });
                  toast.success(`تم توليد القائمة (${res.count} عميل)`);
                  setName(""); setDescription(""); setPreviewData(null);
                  qc.invalidateQueries({ queryKey: ["campaign-audiences"] });
                } catch (e) { toast.error(errMsg(e)); }
                finally { setBusy(null); }
              }}
            >
              توليد وحفظ
            </Button>
          </div>

          {previewData && (
            <div className="rounded-md border p-2 text-xs">
              <div className="font-medium">المطابقون: {previewData.total}</div>
              <div className="text-muted-foreground">
                مستبعدون: {previewData.skipped.suppressed} موقوف · {previewData.skipped.noEmail} بدون بريد
              </div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {previewData.sample.map((s: any) => (
                  <li key={s.email}>{s.email} — {s.orders_count} طلب / {s.total_spent}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">القوائم المولّدة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
          {!isLoading && !audiences?.length && <p className="text-sm text-muted-foreground">لا توجد قوائم بعد.</p>}
          {audiences?.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" /> {a.name}
                  <Badge variant="secondary">{a.member_count} عميل</Badge>
                  {a.provider_list_id && <Badge className="bg-emerald-600">مزامنة #{a.provider_list_id}</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  آخر توليد: {fmt(a.last_generated_at)} · آخر مزامنة: {fmt(a.synced_at)}
                </div>
              </div>
              <Button
                size="sm" variant="outline" disabled={busy === a.id}
                onClick={async () => {
                  setBusy(a.id);
                  try {
                    const res = await sync({ data: { audienceId: a.id } });
                    toast.success(`تمت مزامنة ${res.count} عميل مع مزود التسويق`);
                    qc.invalidateQueries({ queryKey: ["campaign-audiences"] });
                  } catch (e) { toast.error(errMsg(e)); }
                  finally { setBusy(null); }
                }}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> مزامنة مع المزود
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- requests */

function RequestsTab() {
  const qc = useQueryClient();
  const review = useServerFn(reviewCampaignRequest);
  const send = useServerFn(sendCampaignRequest);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sendFor, setSendFor] = useState<CampaignRequest | null>(null);
  const [senderName, setSenderName] = useState("le petit paradis");
  const [senderEmail, setSenderEmail] = useState("");

  const [form, setForm] = useState({
    title: "", objective: "", audience_id: "", coupon_code: "",
    email_subject: "", email_body: "", scheduled_at: "",
  });

  const { data: audiences } = useQuery({
    queryKey: ["campaign-audiences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaign_audiences").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Audience[];
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["campaign-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaign_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CampaignRequest[];
    },
  });

  const createRequest = async () => {
    if (form.title.trim().length < 2) return toast.error("أدخل عنوان الحملة");
    const { error } = await (supabase as any).from("campaign_requests").insert({
      title: form.title.trim(),
      objective: form.objective.trim() || null,
      channel: "email",
      audience_id: form.audience_id || null,
      coupon_code: form.coupon_code.trim() || null,
      email_subject: form.email_subject.trim() || null,
      email_body: form.email_body.trim() || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      status: "pending_review",
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء طلب الحملة");
    setOpen(false);
    setForm({ title: "", objective: "", audience_id: "", coupon_code: "", email_subject: "", email_body: "", scheduled_at: "" });
    qc.invalidateQueries({ queryKey: ["campaign-requests"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Megaphone className="mr-1 h-4 w-4" /> طلب حملة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>طلب حملة تسويقية</DialogTitle></DialogHeader>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto">
              <div><Label>عنوان الحملة</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>الهدف</Label><Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></div>
              <div>
                <Label>قائمة العملاء</Label>
                <Select value={form.audience_id} onValueChange={(v) => setForm({ ...form, audience_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر قائمة" /></SelectTrigger>
                  <SelectContent>
                    {(audiences || []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.member_count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">كود الخصم</Label><Input value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value })} /></div>
                <div><Label className="text-xs">موعد الإرسال</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
              </div>
              <div><Label>عنوان الرسالة</Label><Input value={form.email_subject} onChange={(e) => setForm({ ...form, email_subject: e.target.value })} /></div>
              <div>
                <Label>نص الرسالة (HTML)</Label>
                <Textarea rows={7} value={form.email_body} onChange={(e) => setForm({ ...form, email_body: e.target.value })} />
              </div>
            </div>
            <DialogFooter><Button onClick={createRequest}>إرسال للمراجعة</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
      {!isLoading && !requests?.length && <p className="text-sm text-muted-foreground">لا توجد طلبات حملات.</p>}

      <div className="space-y-2">
        {requests?.map((r) => {
          const aud = audiences?.find((a) => a.id === r.audience_id);
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {r.title} {statusBadge(r.status)}
                    {r.coupon_code && <Badge variant="secondary">{r.coupon_code}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {aud ? `القائمة: ${aud.name} (${aud.member_count})` : "بدون قائمة"} · أُنشئ {fmt(r.created_at)}
                    {r.scheduled_at && ` · مجدول ${fmt(r.scheduled_at)}`}
                    {r.sent_at && ` · أُرسل ${fmt(r.sent_at)} إلى ${r.sent_count}`}
                  </div>
                  {r.rejection_reason && <div className="text-[11px] text-rose-600">سبب الرفض: {r.rejection_reason}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["draft", "pending_review", "rejected"].includes(r.status) && (
                    <Button
                      size="sm" variant="outline" disabled={busy === r.id}
                      onClick={async () => {
                        setBusy(r.id);
                        try {
                          await review({ data: { id: r.id, decision: "approved" } });
                          toast.success("تم اعتماد الحملة");
                          qc.invalidateQueries({ queryKey: ["campaign-requests"] });
                        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> اعتماد
                    </Button>
                  )}
                  {["draft", "pending_review", "approved"].includes(r.status) && (
                    <Button
                      size="sm" variant="outline" disabled={busy === r.id}
                      onClick={async () => {
                        const reason = window.prompt("سبب الرفض؟") ?? "";
                        setBusy(r.id);
                        try {
                          await review({ data: { id: r.id, decision: "rejected", reason } });
                          toast.success("تم رفض الحملة");
                          qc.invalidateQueries({ queryKey: ["campaign-requests"] });
                        } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
                      }}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" /> رفض
                    </Button>
                  )}
                  {r.status === "approved" && !r.sent_at && (
                    <Button size="sm" onClick={() => setSendFor(r)}>
                      <Send className="mr-1 h-3.5 w-3.5" /> إرسال عبر المزود
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!sendFor} onOpenChange={(o) => !o && setSendFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إرسال «{sendFor?.title}»</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم المُرسِل</Label><Input value={senderName} onChange={(e) => setSenderName(e.target.value)} /></div>
            <div><Label>بريد المُرسِل</Label><Input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="offers@lppme.com" /></div>
            <p className="text-[11px] text-muted-foreground">
              يجب أن يكون نطاق البريد موثّقاً لدى مزود التسويق، وتُرسل الحملة فقط للقائمة المتزامنة من العملاء الموافقين.
            </p>
          </div>
          <DialogFooter>
            <Button
              disabled={busy === "send"}
              onClick={async () => {
                if (!sendFor) return;
                setBusy("send");
                try {
                  const res = await send({ data: { id: sendFor.id, senderName, senderEmail } });
                  toast.success(res.scheduled ? "تمت جدولة الحملة" : "تم إرسال الحملة");
                  setSendFor(null);
                  qc.invalidateQueries({ queryKey: ["campaign-requests"] });
                } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
              }}
            >
              تأكيد الإرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------- provider */

function ProviderTab() {
  const status = useServerFn(marketingProviderStatus);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["marketing-provider"],
    queryFn: () => status({ data: undefined as any }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4" /> مزود التسويق البريدي</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? <p className="text-muted-foreground">جاري الفحص…</p> : data?.connected ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            متصل ✅ {(data as any).company ? `— ${(data as any).company}` : ""} {(data as any).email ? `(${(data as any).email})` : ""}
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            غير متصل — اربط حساب مزود التسويق البريدي من بطاقة الربط في المحادثة، ثم أعد الفحص.
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> إعادة الفحص
        </Button>
        <ul className="list-disc space-y-1 pr-5 text-[12px] text-muted-foreground">
          <li>قوائم العملاء تُبنى من الموافقات التسويقية فقط وتُستبعد منها العناوين الموقوفة.</li>
          <li>لا تُرسل أي حملة إلا بعد اعتمادها ومزامنة قائمتها مع المزود.</li>
          <li>روابط إلغاء الاشتراك يضيفها المزود تلقائياً لكل رسالة.</li>
        </ul>
      </CardContent>
    </Card>
  );
}

function MarketingOutreachPage() {
  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Megaphone className="h-5 w-5" /> طلبات الحملات وقوائم العملاء
        </h1>
        <p className="text-sm text-muted-foreground">
          أنشئ طلبات الحملات، ولّد قوائم العملاء الموافقين، وأرسل العروض عبر مزود التسويق البريدي.
        </p>
      </div>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">طلبات الحملات</TabsTrigger>
          <TabsTrigger value="audiences">قوائم العملاء</TabsTrigger>
          <TabsTrigger value="provider">المزود</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-4"><RequestsTab /></TabsContent>
        <TabsContent value="audiences" className="mt-4"><AudiencesTab /></TabsContent>
        <TabsContent value="provider" className="mt-4"><ProviderTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/admin/marketing-outreach")({
  component: MarketingOutreachPage,
  head: () => ({
    meta: [
      { title: "طلبات الحملات وقوائم العملاء | لوحة التحكم" },
      { name: "description", content: "إدارة طلبات الحملات التسويقية وتوليد قوائم العملاء الموافقين وإرسال العروض عبر مزود التسويق البريدي." },
      { property: "og:title", content: "طلبات الحملات وقوائم العملاء" },
      { property: "og:description", content: "إدارة الحملات التسويقية وقوائم العملاء الموافقين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
