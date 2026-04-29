import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Search, MessageCircle } from "lucide-react";
import { buildMeta } from "@/lib/seo";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () =>
    buildMeta({
      title: "الأسئلة الشائعة — Le Petit Paradis",
      description:
        "إجابات على الأسئلة الأكثر شيوعاً حول الطلبات، الدفع، الشحن، والإرجاع لدى Le Petit Paradis.",
      path: "/help",
    }),
});

const CATEGORIES: Record<string, string> = {
  general: "عام", orders: "الطلبات", payment: "الدفع", shipping: "الشحن", returns: "الإرجاع", account: "الحساب",
};

function HelpPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    supabase.from("faq_items").select("*").eq("is_enabled", true).order("sort_order").then(({ data }) => setItems(data || []));
  }, []);

  const filtered = useMemo(() => {
    let arr = items;
    if (cat !== "all") arr = arr.filter(i => i.category === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(i => i.question_ar.toLowerCase().includes(q) || i.answer_ar.toLowerCase().includes(q));
    }
    return arr;
  }, [items, search, cat]);

  const cats = useMemo(() => {
    const set = new Set<string>(items.map(i => i.category));
    return ["all", ...Array.from(set)];
  }, [items]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" dir="rtl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">الأسئلة الشائعة</h1>
        <p className="mt-2 text-sm text-muted-foreground">ابحث عن إجابات سريعة لأكثر الاستفسارات شيوعاً</p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في الأسئلة..." className="w-full rounded-lg border border-border bg-card py-3 pr-10 pl-3 text-sm" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs ${cat===c?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground"}`}>
            {c === "all" ? "الكل" : CATEGORIES[c] || c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(i => (
          <div key={i.id} className="rounded-lg border border-border bg-card">
            <button onClick={() => setOpenId(openId === i.id ? null : i.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right">
              <span className="text-sm font-medium text-foreground">{i.question_ar}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${openId === i.id ? "rotate-180" : ""}`} />
            </button>
            {openId === i.id && (
              <div className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{i.answer_ar}</div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">لا توجد نتائج</p>}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
        <MessageCircle className="h-8 w-8 text-primary" />
        <h3 className="text-base font-semibold">لم تجد إجابتك؟</h3>
        <p className="text-xs text-muted-foreground">تواصل مع فريق الدعم وسنرد خلال 24 ساعة.</p>
        <div className="flex gap-2">
          <Link to="/contact" className="rounded-md border border-border px-4 py-2 text-xs">نموذج التواصل</Link>
          <Link to="/support/new" className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground">فتح تذكرة</Link>
        </div>
      </div>
    </div>
  );
}
