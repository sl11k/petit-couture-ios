import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DbCategoryLite = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  display_order: number | null;
  parent_id: string | null;
};

export type DbCategoryNode = DbCategoryLite & { children: DbCategoryLite[] };

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
          .select("id, slug, name_ar, name_en, image_url, display_order, parent_id")
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

/**
 * Same data, but grouped: top-level categories (parent_id IS NULL) each
 * with their `children` array. Used by header/nav dropdowns.
 */
export function useDbCategoryTree(): DbCategoryNode[] {
  const flat = useDbCategories();
  return useMemo(() => {
    const childrenByParent = new Map<string, DbCategoryLite[]>();
    for (const c of flat) {
      if (c.parent_id) {
        const arr = childrenByParent.get(c.parent_id) ?? [];
        arr.push(c);
        childrenByParent.set(c.parent_id, arr);
      }
    }
    return flat
      .filter((c) => !c.parent_id)
      .map((c) => ({ ...c, children: childrenByParent.get(c.id) ?? [] }));
  }, [flat]);
}
