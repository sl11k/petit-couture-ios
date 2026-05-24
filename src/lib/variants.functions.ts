import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const uuid = z.string().uuid();

// ----- Read: list option types, values, and variants for a product (with stock)
export const getProductVariantsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const [{ data: types, error: e1 }, { data: values, error: e2 }, { data: variants, error: e3 }, { data: bridge, error: e4 }, { data: inv, error: e5 }, { data: warehouses, error: e6 }] = await Promise.all([
      supabaseAdmin.from("product_option_types").select("*").eq("product_id", data.productId).order("position"),
      supabaseAdmin.from("product_option_values").select("*").order("position"),
      supabaseAdmin.from("product_variants").select("*").eq("product_id", data.productId).order("position"),
      supabaseAdmin.from("variant_option_values").select("*"),
      supabaseAdmin.from("inventory").select("*").eq("product_id", data.productId),
      supabaseAdmin.from("warehouses").select("id,name,code,status,priority,country_code").order("priority"),
    ]);
    if (e1 || e2 || e3 || e4 || e5 || e6) {
      throw new Error(e1?.message || e2?.message || e3?.message || e4?.message || e5?.message || e6?.message || "Failed to load");
    }
    const typeIds = new Set((types ?? []).map((t: any) => t.id));
    const filteredValues = (values ?? []).filter((v: any) => typeIds.has(v.option_type_id));
    const variantIds = new Set((variants ?? []).map((v: any) => v.id));
    const filteredBridge = (bridge ?? []).filter((b: any) => variantIds.has(b.variant_id));
    return {
      types: types ?? [],
      values: filteredValues,
      variants: variants ?? [],
      bridge: filteredBridge,
      inventory: inv ?? [],
      warehouses: warehouses ?? [],
    };
  });

// ----- Option types
export const upsertOptionType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid.optional(),
      product_id: uuid,
      name: z.string().min(1).max(60),
      name_en: z.string().max(60).nullable().optional(),
      position: z.number().int().min(0).max(99).default(0),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const payload: any = { product_id: data.product_id, name: data.name, name_en: data.name_en ?? null, position: data.position };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin.from("product_option_types").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabaseAdmin.from("product_option_types").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOptionType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("product_option_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Option values
export const upsertOptionValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid.optional(),
      option_type_id: uuid,
      value: z.string().min(1).max(80),
      value_en: z.string().max(80).nullable().optional(),
      hex_color: z.string().max(20).nullable().optional(),
      image_url: z.string().max(500).nullable().optional(),
      position: z.number().int().min(0).max(99).default(0),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const payload: any = {
      option_type_id: data.option_type_id,
      value: data.value,
      value_en: data.value_en ?? null,
      hex_color: data.hex_color ?? null,
      image_url: data.image_url ?? null,
      position: data.position,
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin.from("product_option_values").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabaseAdmin.from("product_option_values").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOptionValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("product_option_values").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Variants
export const upsertVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid.optional(),
      product_id: uuid,
      sku: z.string().max(120).nullable().optional(),
      barcode: z.string().max(120).nullable().optional(),
      price_override: z.number().nullable().optional(),
      compare_at_price_override: z.number().nullable().optional(),
      image_url: z.string().max(500).nullable().optional(),
      is_active: z.boolean().default(true),
      position: z.number().int().min(0).max(999).default(0),
      option_value_ids: z.array(uuid).default([]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const payload: any = {
      product_id: data.product_id,
      sku: data.sku ?? null,
      barcode: data.barcode ?? null,
      price_override: data.price_override ?? null,
      compare_at_price_override: data.compare_at_price_override ?? null,
      image_url: data.image_url ?? null,
      is_active: data.is_active,
      position: data.position,
    };
    let variantId = data.id;
    if (variantId) {
      const { error } = await supabaseAdmin.from("product_variants").update(payload).eq("id", variantId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabaseAdmin.from("product_variants").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      variantId = row.id as string;
    }
    // Refresh bridge
    await supabaseAdmin.from("variant_option_values").delete().eq("variant_id", variantId);
    if (data.option_value_ids.length > 0) {
      const rows = data.option_value_ids.map((ov) => ({ variant_id: variantId!, option_value_id: ov }));
      const { error } = await supabaseAdmin.from("variant_option_values").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { id: variantId };
  });

export const deleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("product_variants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Per-variant inventory upsert (per warehouse)
export const upsertVariantInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      product_id: uuid,
      variant_id: uuid.nullable(),
      warehouse_id: uuid,
      quantity: z.number().int().min(0).max(10_000_000),
      low_stock_threshold: z.number().int().min(0).max(10_000).default(5),
      sku: z.string().max(120).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    // Manual upsert because the unique index uses COALESCE on variant_id
    const q = supabaseAdmin
      .from("inventory")
      .select("id")
      .eq("product_id", data.product_id)
      .eq("warehouse_id", data.warehouse_id);
    const { data: existing, error: e0 } = data.variant_id
      ? await q.eq("variant_id", data.variant_id).maybeSingle()
      : await q.is("variant_id", null).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (existing?.id) {
      const { error } = await supabaseAdmin.from("inventory").update({
        quantity: data.quantity,
        low_stock_threshold: data.low_stock_threshold,
        sku: data.sku ?? null,
      }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, updated: true };
    }
    const { data: row, error } = await supabaseAdmin.from("inventory").insert({
      product_id: data.product_id,
      variant_id: data.variant_id,
      warehouse_id: data.warehouse_id,
      quantity: data.quantity,
      low_stock_threshold: data.low_stock_threshold,
      sku: data.sku ?? null,
      status: "active",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id, updated: false };
  });

// ----- Public read for storefront
export const getProductVariantsPublic = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ productId: uuid }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("get_product_variants_with_stock", { _product_id: data.productId });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
