import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const uuid = z.string().uuid();

// List inventory rows for a single warehouse (with product info)
export const listWarehouseInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ warehouseId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("inventory")
      .select("id, product_id, variant_id, warehouse_id, sku, quantity, reserved_quantity, low_stock_threshold, status, updated_at, products(id, name, name_ar, name_en, slug, image_url, sku), product_variants(id, sku)")
      .eq("warehouse_id", data.warehouseId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// Transfer stock from one warehouse to another (RPC handles atomicity + auth)
export const transferStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      productId: uuid,
      variantId: uuid.nullable().optional(),
      fromWarehouse: uuid,
      toWarehouse: uuid,
      qty: z.number().int().min(1).max(100000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).rpc("transfer_inventory", {
      _product_id: data.productId,
      _variant_id: data.variantId ?? null,
      _from_warehouse: data.fromWarehouse,
      _to_warehouse: data.toWarehouse,
      _qty: data.qty,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Adjust quantity / threshold / status for a single inventory row
export const updateInventoryRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      quantity: z.number().int().min(0).max(1_000_000).optional(),
      low_stock_threshold: z.number().int().min(0).max(100000).optional(),
      sku: z.string().max(64).nullable().optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    const { error } = await (supabaseAdmin as any)
      .from("inventory").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Admin: reassign an order item to a different warehouse
export const reassignOrderItemWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ itemId: uuid, newWarehouseId: uuid }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).rpc(
      "reassign_order_item_warehouse",
      { _item_id: data.itemId, _new_warehouse: data.newWarehouseId },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// List all active warehouses (for selectors)
export const listWarehousesLite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("warehouses")
      .select("id, code, name, name_en, city, country_code, status, priority")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return { warehouses: data ?? [] };
  });
