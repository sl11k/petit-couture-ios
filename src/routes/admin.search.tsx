import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, AlertCircle, TrendingUp, Plus, Trash2 } from "lucide-react";
import { fetchSearchReport } from "@/lib/search";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/admin/search")({
  component: AdminSearchPage,
  head: () => ({ meta: [{ title: "تقارير البحث - الإدارة" }] }),
});

function AdminSearchPage() {
  const [report, setReport] = useState<any>({ top: [], zero: [], total: 0 });
  const [synonyms, setSynonyms] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"top" | "zero" | "synonyms">("top");
  const [newTerm, setNewTerm] = useState("");
  const [newSyn, setNewSyn] = useState("");

  async function reload() {
    const [r, { data }] = await Promise.all([
      fetchSearchReport(days),
      supabase.from("search_synonyms").select("*").order("created_at", { ascending: false }),
    ]);
    setReport(r);
    setSynonyms(data ?? []);
  }
  useEffect(() => { reload(); }, [days]);

  async function addSynonym() {
    const t = newTerm.trim().toLowerCase(); const s = newSyn.trim().toLowerCase();
    if (!t || !s) return;
    await supabase.from("search_synonyms").insert({ term: t, synonym: s });
    await logAudit("synonym.create", { entity: "search_synonyms", new_data: { term: t, synonym: s } });
    setNewTerm(""); setNewSyn(""); reload();
  }
  async function removeSynonym(id: string) {
    await supabase.from("search_synonyms").delete().eq("id", id);
    await logAudit("synonym.delete", { entity: "search_synonyms", entity_id: id });
    reload();
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><SearchIcon className="h-6 w-6" /> تقارير البحث</h1>
          <p className="text-sm text-muted-foreground mt-1">{report.total} عملية بحث خلال آخر {days} يوم</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 px-3 rounded border bg-background text-sm">
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يوم</option>
          <option value={90}>آخر 90 يوم</option>
        </select>
      </header>

      <div className="flex gap-2 border-b border-border">
        {[
          { k: "top", label: "الأكثر بحثًا", icon: TrendingUp },
          { k: "zero", label: "بحث بدون نتائج", icon: AlertCircle },
          { k: "synonyms", label: "المرادفات", icon: Plus },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 text-sm flex items-center gap-2 border-b-2 -mb-px ${tab === t.k ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "top" && (
        <Table headers={["الكلمة", "عدد عمليات البحث", "نقرات", "نسبة النقر CTR"]}
          rows={report.top.map((r: any) => [r.query, r.count, r.clicks, `${(r.ctr * 100).toFixed(1)}%`])} />
      )}

      {tab === "zero" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">عبارات بحث لم تُرجع أي نتيجة — أضف منتجات أو مرادفات لتحسينها.</p>
          <Table headers={["الكلمة", "مرات بدون نتائج", "إجمالي البحث"]}
            rows={report.zero.map((r: any) => [r.query, r.zero, r.count])} />
        </div>
      )}

      {tab === "synonyms" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-32">
              <label className="text-xs text-muted-foreground">الكلمة الأصلية</label>
              <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="مثال: فستان"
                className="w-full h-9 px-3 rounded border bg-background mt-1" />
            </div>
            <div className="flex-1 min-w-32">
              <label className="text-xs text-muted-foreground">المرادف</label>
              <input value={newSyn} onChange={(e) => setNewSyn(e.target.value)} placeholder="مثال: dress"
                className="w-full h-9 px-3 rounded border bg-background mt-1" />
            </div>
            <button onClick={addSynonym} className="h-9 px-4 bg-primary text-primary-foreground rounded text-sm flex items-center gap-1">
              <Plus className="h-4 w-4" /> إضافة
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-start p-2">الكلمة</th><th className="text-start p-2">المرادف</th><th className="w-12"></th>
              </tr></thead>
              <tbody>
                {synonyms.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2">{s.term}</td>
                    <td className="p-2">{s.synonym}</td>
                    <td className="p-2"><button onClick={() => removeSynonym(s.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {!synonyms.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">لا توجد مرادفات بعد</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50"><tr>{headers.map((h) => <th key={h} className="text-start p-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>
          ))}
          {!rows.length && <tr><td colSpan={headers.length} className="p-6 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
