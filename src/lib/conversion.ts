import { supabase } from "@/integrations/supabase/client";

// ===== Reviews =====
export async function fetchProductReviews(productId: string) {
  const { data } = await supabase.from("reviews")
    .select("*").eq("product_id", productId).eq("status", "approved")
    .order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function fetchProductRating(productId: string): Promise<{ avg: number; count: number }> {
  const { data } = await supabase.from("reviews")
    .select("rating").eq("product_id", productId).eq("status", "approved");
  if (!data || data.length === 0) return { avg: 0, count: 0 };
  const sum = data.reduce((a: number, r: any) => a + r.rating, 0);
  return { avg: sum / data.length, count: data.length };
}

// ===== Recommendations =====
export type RecoType = "similar" | "complementary" | "upsell" | "cross_sell";

export async function fetchRecommendations(productId: string, type: RecoType, limit = 6) {
  const { data } = await supabase.from("product_recommendations")
    .select("recommended_id, position")
    .eq("product_id", productId).eq("type", type)
    .order("position").limit(limit);
  if (!data || data.length === 0) {
    // fallback: same category
    const { data: prod } = await supabase.from("products").select("category_id").eq("id", productId).maybeSingle();
    if (!prod?.category_id) return [];
    const { data: similar } = await supabase.from("products")
      .select("*").eq("category_id", prod.category_id).eq("is_active", true)
      .neq("id", productId).limit(limit);
    return similar ?? [];
  }
  const ids = data.map((r: any) => r.recommended_id);
  const { data: products } = await supabase.from("products").select("*").in("id", ids).eq("is_active", true);
  return products ?? [];
}

// ===== Loyalty =====
export interface LoyaltyConfig {
  loyalty_enabled: boolean;
  loyalty_points_per_currency: number;
  loyalty_redeem_rate: number;
  loyalty_signup_bonus: number;
}

export function calculatePointsForOrder(amount: number, perCurrency: number) {
  return Math.floor(amount * perCurrency);
}

export function pointsToValue(points: number, redeemRate: number) {
  return points / redeemRate;
}

export function tierFromLifetime(lifetime: number) {
  if (lifetime >= 5000) return "platinum";
  if (lifetime >= 2000) return "gold";
  if (lifetime >= 500) return "silver";
  return "bronze";
}

export async function awardPoints(userId: string, delta: number, reason: string, relatedId?: string) {
  const { data: acc } = await supabase.from("loyalty_accounts").select("*").eq("user_id", userId).maybeSingle();
  const newBalance = (acc?.balance ?? 0) + delta;
  const newLifetime = (acc?.lifetime_earned ?? 0) + Math.max(0, delta);
  const tier = tierFromLifetime(newLifetime);
  if (acc) {
    await supabase.from("loyalty_accounts").update({ balance: newBalance, lifetime_earned: newLifetime, tier }).eq("user_id", userId);
  } else {
    await supabase.from("loyalty_accounts").insert({ user_id: userId, balance: newBalance, lifetime_earned: newLifetime, tier });
  }
  await supabase.from("loyalty_transactions").insert({ user_id: userId, delta, reason, related_id: relatedId });
}

// ===== Referrals =====
export function generateReferralCode(userId: string) {
  return ("REF-" + userId.slice(0, 8) + "-" + Math.random().toString(36).slice(2, 6)).toUpperCase();
}

// ===== Search =====
export async function logSearch(query: string, resultsCount: number, sessionId?: string) {
  if (!query.trim()) return;
  await supabase.from("search_logs").insert({
    query: query.trim().toLowerCase(), results_count: resultsCount, session_id: sessionId ?? null,
  });
}

export async function getSearchSuggestions(failedQuery: string): Promise<string[]> {
  // 1) check synonyms
  const { data: syn } = await supabase.from("search_synonyms").select("synonym")
    .ilike("term", `%${failedQuery}%`).limit(5);
  if (syn && syn.length > 0) return syn.map((s: any) => s.synonym);
  // 2) suggest popular searches
  const { data: pop } = await supabase.from("search_logs")
    .select("query").gt("results_count", 0).order("created_at", { ascending: false }).limit(50);
  const counts = new Map<string, number>();
  (pop ?? []).forEach((r: any) => counts.set(r.query, (counts.get(r.query) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([q]) => q);
}
