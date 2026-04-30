import { useEffect, useState } from "react";
import { Search, X, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

export type ProductLite = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  sku: string | null;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
};

/* ---------------- Product picker modal ---------------- */
export function ProductPickerModal({
  excludedIds, onAdd, onClose,
}: {
  excludedIds: string[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("id, name_ar, name_en, sku, price, image_url, is_active")
        .order("created_at", { ascending: false })
        .limit(40);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(`name_ar.ilike.${term},name_en.ilike.${term},sku.ilike.${term}`);
      }
      const { data } = await query;
      if (!alive) return;
      setResults((data ?? []) as ProductLite[]);
      setLoading(false);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-background rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col border border-border">
        <header className="px-5 h-14 border-b border-border flex items-center justify-between">
          <h2 className="font-medium text-sm">{ar ? "اختر المنتجات" : "Select products"} ({picked.size})</h2>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-cream-warm">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? "ابحث بالاسم أو SKU..." : "Search by name or SKU..."}
              className="w-full h-10 ps-10 pe-3 border border-border rounded-md bg-background text-sm outline-none focus:border-gold"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">{ar ? "جارِ البحث..." : "Searching..."}</p>
          ) : results.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{ar ? "لا توجد نتائج" : "No results"}</p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((p) => {
                const already = excludedIds.includes(p.id);
                const checked = picked.has(p.id);
                return (
                  <li key={p.id}>
                    <label className={[
                      "flex items-center gap-3 p-2.5 rounded-md cursor-pointer",
                      already ? "opacity-50 cursor-not-allowed" : "hover:bg-cream-warm",
                    ].join(" ")}>
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4"
                      />
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-12 w-12 object-cover rounded" />
                      ) : (
                        <div className="h-12 w-12 bg-muted rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.sku} · {p.price?.toFixed(2)} SAR
                          {already && <span className="ms-2">{ar ? "(مُضاف)" : "(already added)"}</span>}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="p-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-cream-warm">
            {ar ? "إلغاء" : "Cancel"}
          </button>
          <button
            onClick={() => onAdd([...picked])}
            disabled={picked.size === 0}
            className="h-9 px-4 rounded-md bg-foreground text-background text-sm disabled:opacity-50"
          >
            {ar ? `إضافة (${picked.size})` : `Add (${picked.size})`}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ---------------- Selected list with reorder ---------------- */
export function SelectedProductsList({
  productIds, onChange,
}: {
  productIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [items, setItems] = useState<ProductLite[]>([]);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (productIds.length === 0) { setItems([]); return; }
    supabase.from("products")
      .select("id, name_ar, name_en, sku, price, image_url, is_active")
      .in("id", productIds)
      .then(({ data }) => {
        const map = new Map((data ?? []).map((p) => [p.id, p as ProductLite]));
        setItems(productIds.map((id) => map.get(id)).filter(Boolean) as ProductLite[]);
      });
  }, [productIds]);

  function move(idx: number, dir: -1 | 1) {
    const next = [...productIds];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    onChange(next);
  }
  function remove(id: string) {
    onChange(productIds.filter((x) => x !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/80">
          {ar ? `المنتجات المختارة (${productIds.length})` : `Selected products (${productIds.length})`}
        </p>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-cream-warm"
        >
          <Plus className="h-3.5 w-3.5" /> {ar ? "إضافة" : "Add"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {ar ? "لا توجد منتجات. اضغط «إضافة» للبحث والاختيار." : "No products yet. Click Add to search and pick."}
        </div>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border">
          {items.map((p, idx) => (
            <li key={p.id} className="flex items-center gap-2 p-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="h-5 w-5 grid place-items-center rounded hover:bg-cream-warm disabled:opacity-30">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}
                  className="h-5 w-5 grid place-items-center rounded hover:bg-cream-warm disabled:opacity-30">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground w-5 text-center">{idx + 1}</span>
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-10 w-10 object-cover rounded" />
              ) : (
                <div className="h-10 w-10 bg-muted rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{ar ? (p.name_ar ?? p.name_en) : (p.name_en ?? p.name_ar)}</p>
                <p className="text-[11px] text-muted-foreground truncate">{p.sku} · {p.price?.toFixed(2)} SAR</p>
              </div>
              <button type="button" onClick={() => remove(p.id)} aria-label="Remove"
                className="h-7 w-7 grid place-items-center rounded-md text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {picker && (
        <ProductPickerModal
          excludedIds={productIds}
          onClose={() => setPicker(false)}
          onAdd={(ids) => { onChange([...productIds, ...ids]); setPicker(false); }}
        />
      )}
    </div>
  );
}
