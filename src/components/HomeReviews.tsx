import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

type Review = {
  id: string;
  customer_name: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

/**
 * Inline reviews strip rendered on the home screen.
 * Always shows the latest approved reviews so they appear automatically
 * once moderated in /admin/reviews — no page-builder wiring required.
 */
export function HomeReviews({ limit = 6 }: { limit?: number }) {
  const { isRTL } = useLanguage();
  const ar = isRTL;
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("reviews")
          .select("id, customer_name, rating, title, body, created_at")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!cancelled) setRows((data as Review[]) ?? []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [limit]);

  if (loading || rows.length === 0) return null;

  return (
    <section className="mt-12 px-5">
      <div className="text-center">
        <p className="text-[10px] tracking-luxury text-gold-deep">
          {ar ? "— آراء عملائنا —" : "— CUSTOMER REVIEWS —"}
        </p>
        <h2 className="mt-2 text-[20px] font-serif text-foreground">
          {ar ? "ماذا يقول عملاؤنا" : "What our customers say"}
        </h2>
      </div>
      <div className="mt-5 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scrollbar-none">
        {rows.map((r) => (
          <article
            key={r.id}
            className="snap-start shrink-0 w-[78%] sm:w-[320px] bg-cream-warm rounded-2xl p-4 border border-gold-soft/50"
          >
            <div className="flex items-center gap-0.5 text-gold">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  strokeWidth={1.5}
                  fill={i < r.rating ? "currentColor" : "none"}
                />
              ))}
            </div>
            {r.title && (
              <h3 className="mt-2 text-[13.5px] font-medium text-foreground line-clamp-1">
                {r.title}
              </h3>
            )}
            {r.body && (
              <p className="mt-1.5 text-[12.5px] text-foreground/75 leading-relaxed line-clamp-4">
                {r.body}
              </p>
            )}
            <p className="mt-3 text-[11px] tracking-soft text-gold-deep">
              — {r.customer_name || (ar ? "عميل" : "Customer")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
