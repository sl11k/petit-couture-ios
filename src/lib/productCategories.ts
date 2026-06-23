import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve every product assigned to a category across the current admin
 * junction table and the two legacy storage shapes. The admin writes to
 * product_categories; older storefront code used category_products or the
 * products.category_id column.
 */
export async function getCategoryProductIds(categoryId: string, limit = 200) {
  const ids: string[] = [];
  const add = (rows: Array<{ product_id?: string; id?: string }> | null) => {
    for (const row of rows ?? []) {
      const id = row.product_id ?? row.id;
      if (id && !ids.includes(id)) ids.push(id);
      if (ids.length >= limit) break;
    }
  };

  const current = await (supabase as any)
    .from("product_categories")
    .select("product_id")
    .eq("category_id", categoryId)
    .limit(limit);
  if (!current.error) add(current.data);

  if (ids.length < limit) {
    const legacy = await (supabase as any)
      .from("category_products")
      .select("product_id")
      .eq("category_id", categoryId)
      .order("display_order", { ascending: true })
      .limit(limit);
    if (!legacy.error) add(legacy.data);
  }

  if (ids.length < limit) {
    const direct = await supabase
      .from("products")
      .select("id")
      .eq("category_id", categoryId)
      .limit(limit);
    if (!direct.error) add(direct.data);
  }

  return ids.slice(0, limit);
}
