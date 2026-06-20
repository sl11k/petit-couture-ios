import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link2, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LinkType = "page" | "category" | "product" | "external";

type Item = { label: string; url: string };

const TYPE_LABELS: Record<LinkType, string> = {
  page: "صفحة من المتجر",
  category: "تصنيف",
  product: "منتج",
  external: "رابط خارجي",
};

const STATIC_PAGES: Item[] = [
  { label: "الرئيسية (/)", url: "/" },
  { label: "كل المنتجات (/products)", url: "/products" },
  { label: "السلة (/cart)", url: "/cart" },
  { label: "إتمام الطلب (/checkout)", url: "/checkout" },
  { label: "تسجيل الدخول (/login)", url: "/login" },
  { label: "حسابي (/account)", url: "/account" },
  { label: "اتصل بنا (/contact)", url: "/contact" },
];

function detectType(url?: string): LinkType {
  if (!url) return "external";
  if (url.startsWith("/category/")) return "category";
  if (url.startsWith("/product/")) return "product";
  if (url.startsWith("/page/") || url.startsWith("/")) return "page";
  return "external";
}

export function LinkPicker({
  value,
  onChange,
  placeholder = "اختر رابط…",
}: {
  value?: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LinkType>(detectType(value));
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState(value ?? "");

  useEffect(() => { setCustom(value ?? ""); }, [value]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        if (type === "page") {
          const { data } = await supabase.from("cms_pages").select("slug,title_ar,title_en").eq("status", "published").order("title_ar");
          const dynamic = (data ?? []).map((p: any) => ({ label: p.title_ar || p.title_en || p.slug, url: `/page/${p.slug}` }));
          if (!cancel) setItems([...STATIC_PAGES, ...dynamic]);
        } else if (type === "category") {
          const { data } = await supabase.from("categories").select("slug,name_ar,name_en").eq("is_active", true).order("name_ar");
          if (!cancel) setItems((data ?? []).map((c: any) => ({ label: c.name_ar || c.name_en || c.slug, url: `/category/${c.slug}` })));
        } else if (type === "product") {
          const { data } = await supabase.from("products").select("slug,name_ar,name_en").eq("is_active", true).order("name_ar").limit(200);
          if (!cancel) setItems((data ?? []).map((p: any) => ({ label: p.name_ar || p.name_en || p.slug, url: `/product/${p.slug}` })));
        } else {
          setItems([]);
        }
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [type, open]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(s) || it.url.toLowerCase().includes(s));
  }, [items, q]);

  const display = value ? (value.length > 32 ? value.slice(0, 32) + "…" : value) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full justify-start font-normal">
          <Link2 className="h-3.5 w-3.5 me-2 shrink-0" />
          <span className="truncate text-xs">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-3" align="start">
        <div>
          <Label className="text-xs mb-1 block">نوع الرابط</Label>
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(TYPE_LABELS) as LinkType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`text-[10px] rounded-md border px-1.5 py-1.5 ${type === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {type !== "external" && (
          <>
            <div className="relative">
              <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="ps-7 h-8 text-xs" placeholder="ابحث…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-56 overflow-auto rounded-md border border-border">
              {loading && <div className="p-2 text-xs text-muted-foreground">جارٍ التحميل…</div>}
              {!loading && filtered.length === 0 && <div className="p-2 text-xs text-muted-foreground">لا توجد نتائج</div>}
              {!loading && filtered.map((it) => (
                <button
                  key={it.url}
                  type="button"
                  onClick={() => { onChange(it.url); setCustom(it.url); setOpen(false); }}
                  className={`w-full text-start px-2 py-1.5 text-xs hover:bg-muted border-b border-border last:border-b-0 ${value === it.url ? "bg-muted" : ""}`}
                >
                  <div className="truncate">{it.label}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{it.url}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            {type === "external" ? "الرابط الخارجي" : "أو رابط مخصص"}
          </Label>
          <div className="flex gap-1">
            <Input
              className="h-8 text-xs"
              placeholder={type === "external" ? "https://example.com" : "/مسار-مخصص"}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { onChange(custom); setOpen(false); } }}
            />
            <Button type="button" size="sm" className="h-8" onClick={() => { onChange(custom); setOpen(false); }}>حفظ</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
