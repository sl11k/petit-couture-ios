import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Loader2, ShoppingBag, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type OrderHit = {
  kind: "order";
  id: string;
  order_number: string;
  customer_name: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

type CustomerHit = {
  kind: "customer";
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type Hit = OrderHit | CustomerHit;

const MAX_LEN = 80;

export function AdminQuickSearch() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sanitize: trim + length cap; strip postgrest-special chars used in ilike pattern
  const cleaned = useMemo(() => {
    return q.trim().slice(0, MAX_LEN).replace(/[%,]/g, " ").replace(/\s+/g, " ");
  }, [q]);

  // Debounced search
  useEffect(() => {
    if (cleaned.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${cleaned}%`;
      const [ordersRes, custRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,order_number,customer_name,total,status,created_at")
          .or(`order_number.ilike.${like},customer_name.ilike.${like},customer_email.ilike.${like},customer_phone.ilike.${like}`)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("profiles")
          .select("user_id,full_name,email,phone")
          .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(6),
      ]);
      const o: Hit[] = (ordersRes.data ?? []).map((r: any) => ({
        kind: "order",
        id: r.id,
        order_number: r.order_number,
        customer_name: r.customer_name,
        total: r.total,
        status: r.status,
        created_at: r.created_at,
      }));
      const c: Hit[] = (custRes.data ?? []).map((r: any) => ({
        kind: "customer",
        user_id: r.user_id,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
      }));
      setHits([...o, ...c]);
      setActive(0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [cleaned]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Cmd/Ctrl + K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = wrapRef.current?.querySelector("input");
        (el as HTMLInputElement | null)?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const goto = (h: Hit) => {
    setOpen(false);
    setQ("");
    if (h.kind === "order") navigate({ to: "/admin/orders/$id", params: { id: h.id } });
    else navigate({ to: "/admin/customers/$id", params: { id: h.user_id } });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); goto(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${ar ? "right-3" : "left-3"}`} />
        <input
          type="text"
          value={q}
          maxLength={MAX_LEN}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={ar ? "بحث عن عميل أو رقم طلب… (Ctrl+K)" : "Search customers or order #… (Ctrl+K)"}
          className={`h-10 w-full rounded-md border border-border bg-background text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 ${ar ? "pr-9 pl-9" : "pl-9 pr-9"}`}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); setHits([]); }}
            className={`absolute top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground ${ar ? "left-2" : "right-2"}`}
            aria-label={ar ? "مسح" : "Clear"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && cleaned.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {ar ? "جاري البحث…" : "Searching…"}
            </div>
          ) : hits.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {ar ? "لا توجد نتائج" : "No results"}
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-auto">
              {hits.map((h, i) => {
                const isActive = i === active;
                if (h.kind === "order") {
                  return (
                    <li key={`o-${h.id}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => goto(h)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-start transition-colors ${isActive ? "bg-muted/60" : "hover:bg-muted/30"}`}
                      >
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{h.order_number}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {h.customer_name || (ar ? "بدون اسم" : "No name")} · {new Date(h.created_at).toLocaleDateString(ar ? "ar" : "en")}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {h.total != null ? `${Number(h.total).toLocaleString(ar ? "ar" : "en")} ${ar ? "ر.س" : "SAR"}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={`c-${h.user_id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => goto(h)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-start transition-colors ${isActive ? "bg-muted/60" : "hover:bg-muted/30"}`}
                    >
                      <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {h.full_name || (ar ? "بدون اسم" : "No name")}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground" dir="ltr">
                          {h.email || h.phone || "—"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-border bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
            <Link to="/admin/orders" className="hover:underline">{ar ? "كل الطلبات" : "All orders"}</Link>
            {" · "}
            <Link to="/admin/customers" className="hover:underline">{ar ? "كل العملاء" : "All customers"}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
