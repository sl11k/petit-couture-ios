import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Loader2 } from "lucide-react";
import { autocomplete, spellSuggest, recordSearchClick, type SuggestionItem } from "@/lib/search";

interface Props {
  isRTL?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onClose?: () => void;
}

export function SearchBar({ isRTL = true, placeholder, autoFocus, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    if (!q.trim()) { setItems([]); setDidYouMean(null); return; }
    setLoading(true);
    debRef.current = window.setTimeout(async () => {
      const [sug, sp] = await Promise.all([autocomplete(q, 8), spellSuggest(q)]);
      setItems(sug);
      setDidYouMean(sug.length === 0 && sp ? sp : null);
      setLoading(false);
    }, 180);
    return () => { if (debRef.current) window.clearTimeout(debRef.current); };
  }, [q]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function submit(query?: string) {
    const text = (query ?? q).trim();
    if (!text) return;
    setOpen(false);
    onClose?.();
    navigate({ to: "/search", search: { q: text } as any });
  }

  function pickItem(it: SuggestionItem) {
    setOpen(false);
    if (it.kind === "product") {
      recordSearchClick(q, it.id);
      navigate({ to: "/search", search: { q: isRTL ? it.label_ar : it.label_en } as any });
    } else {
      navigate({ to: "/category/$slug", params: { slug: it.slug } });
    }
    onClose?.();
  }

  return (
    <div ref={ref} className="relative w-full" dir={isRTL ? "rtl" : "ltr"}>
      <div className="relative flex items-center">
        <Search className={`absolute ${isRTL ? "right-3" : "left-3"} h-4 w-4 text-muted-foreground pointer-events-none`} />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
          placeholder={placeholder ?? (isRTL ? "ابحث عن منتج، قسم، أو علامة..." : "Search products, categories, brands...")}
          className={`w-full ${isRTL ? "pr-10 pl-9" : "pl-10 pr-9"} h-11 rounded-full bg-muted/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm`}
        />
        {q && (
          <button onClick={() => { setQ(""); setItems([]); }} className={`absolute ${isRTL ? "left-3" : "right-3"} text-muted-foreground hover:text-foreground`} aria-label="clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (q.trim() || loading) && (
        <div className="absolute z-50 mt-2 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {isRTL ? "جاري البحث..." : "Searching..."}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              {didYouMean ? (
                <div>
                  <div className="mb-2">{isRTL ? "لا توجد نتائج." : "No results."}</div>
                  <button onClick={() => { setQ(didYouMean); submit(didYouMean); }} className="text-primary hover:underline">
                    {isRTL ? `هل تقصد: ${didYouMean}؟` : `Did you mean: ${didYouMean}?`}
                  </button>
                </div>
              ) : (
                <span>{isRTL ? "لا توجد اقتراحات." : "No suggestions."}</span>
              )}
            </div>
          )}

          {!loading && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={`${it.kind}-${it.id}`}>
                  <button
                    onClick={() => pickItem(it)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/60 text-start"
                  >
                    {it.image_url ? (
                      <img src={it.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        {it.kind === "category" ? (isRTL ? "قسم" : "Cat") : "🛍"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{isRTL ? it.label_ar : it.label_en}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.kind === "category" ? (isRTL ? "قسم" : "Category") : (it.price != null ? `${it.price} SAR` : "")}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => submit()} className="w-full p-3 text-center text-sm text-primary hover:bg-muted/60 font-medium">
                  {isRTL ? `عرض كل النتائج عن "${q}"` : `See all results for "${q}"`}
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
