/**
 * Internal server functions (RPC) — used by the React app.
 * For external partners use the REST routes under /api/v1/*.
 *
 * Each function uses requireSupabaseAuth so RLS applies as the user.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----- Products -----
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).max(1000).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().max(200).optional(),
      categoryId: z.string().uuid().optional(),
      onlyActive: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabase
      .from("products")
      .select("id,sku,name_ar,name_en,brand,price,stock,is_active,image_url,category_id", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.onlyActive) q = q.eq("is_active", true);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.search) q = q.or(`name_ar.ilike.%${data.search}%,name_en.ilike.%${data.search}%,sku.ilike.%${data.search}%`);
    const { data: rows, count, error } = await q;
    if (error) return { items: [], total: 0, error: error.message };
    return { items: rows ?? [], total: count ?? 0, error: null };
  });

// ----- Orders -----
export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      status: z.string().max(50).optional(),
      paymentStatus: z.string().max(50).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabase
      .from("orders")
      .select("id,order_number,status,payment_status,total,currency,customer_id,created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.status) q = q.eq("status", data.status);
    if (data.paymentStatus) q = q.eq("payment_status", data.paymentStatus);
    const { data: rows, count, error } = await q;
    if (error) return { items: [], total: 0, error: error.message };
    return { items: rows ?? [], total: count ?? 0, error: null };
  });

// ----- Customers -----
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await supabase
      .from("profiles")
      .select("user_id,email,full_name,phone,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) return { items: [], total: 0, error: error.message };
    return { items: rows ?? [], total: count ?? 0, error: null };
  });

// ----- Inventory -----
export const updateInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      productId: z.string().uuid(),
      stock: z.number().int().min(0).max(1_000_000),
      reason: z.string().max(200).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("products")
      .update({ stock: data.stock })
      .eq("id", data.productId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  });

// ----- Reports (summary KPIs) -----
export const reportSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [orders, customers] = await Promise.all([
      supabase.from("orders").select("total,status,payment_status,created_at").gte("created_at", since),
      supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", since),
    ]);
    const ordersData = orders.data ?? [];
    const revenue = ordersData
      .filter((o: any) => o.payment_status === "paid")
      .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    return {
      window_days: 30,
      orders_count: ordersData.length,
      revenue,
      paid_orders: ordersData.filter((o: any) => o.payment_status === "paid").length,
      new_customers: customers.count ?? 0,
    };
  });
