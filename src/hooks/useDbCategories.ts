import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DbCategoryLite = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  display_order: number | null;
};

/**
 * Fetch all active categories from the DB ordered by display_order.
 * Used to keep header, footer, mobile nav, and home page in sync with
 * the categories admin without manual wiring.
 */
export function useDbCategories(): DbCategoryLite[] {
  const [rows, setRows] = useState<DbCategoryLite[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("categories")
          .select("id, slug, name_ar, name_en, image_url, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (!cancelled) setRows((data as DbCategoryLite[]) ?? []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return rows;
}
