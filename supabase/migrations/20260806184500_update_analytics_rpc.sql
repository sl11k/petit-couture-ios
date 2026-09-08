CREATE OR REPLACE FUNCTION public.get_site_analytics_v1(since timestamptz, host_domain text DEFAULT 'petit-couture.com')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  res jsonb;
BEGIN
  WITH filtered_events AS (
    SELECT 
      session_id, 
      created_at, 
      referrer, 
      event_name, 
      path,
      metadata,
      CASE 
        WHEN referrer LIKE 'http%' THEN
          replace(substring(referrer from '^https?://([^/]+)'), 'www.', '')
        ELSE referrer
      END as ref_domain
    FROM public.analytics_events
    WHERE created_at >= since
  ),
  valid_events AS (
    SELECT *
    FROM filtered_events
    WHERE ref_domain IS NULL 
       OR (ref_domain NOT ILIKE '%lovable.dev' 
           AND ref_domain NOT ILIKE '%lovableproject.com' 
           AND ref_domain NOT ILIKE '%lovable.app')
  ),
  uniq_sess AS (
    SELECT count(DISTINCT session_id) as c FROM valid_events
  ),
  ref_clicks AS (
    SELECT count(*) as c FROM valid_events 
    WHERE ref_domain IS NOT NULL AND ref_domain != '' AND ref_domain NOT ILIKE '%' || host_domain || '%'
  ),
  d_visits AS (
    SELECT to_char(created_at, 'YYYY-MM-DD') as date, count(DISTINCT session_id) as visits
    FROM valid_events
    GROUP BY 1
    ORDER BY 1
  ),
  t_refs AS (
    SELECT ref_domain as source, count(*) as count
    FROM valid_events
    WHERE ref_domain IS NOT NULL AND ref_domain != '' AND ref_domain NOT ILIKE '%' || host_domain || '%'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 15
  ),
  t_pages AS (
    SELECT path, count(*) as count
    FROM valid_events
    WHERE path IS NOT NULL AND path != ''
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 15
  ),
  t_events AS (
    SELECT event_name as name, count(*) as count
    FROM valid_events
    WHERE event_name IS NOT NULL AND event_name != ''
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 15
  ),
  t_total_product_views AS (
    SELECT count(*) as c
    FROM valid_events
    WHERE event_name = 'product_view'
  ),
  t_products AS (
    SELECT 
      nullif(metadata->>'product_id', '')::uuid as product_id, 
      count(*) as views_count
    FROM valid_events
    WHERE event_name = 'product_view' AND nullif(metadata->>'product_id', '') IS NOT NULL
      AND nullif(metadata->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ),
  t_products_enriched AS (
    SELECT 
      tp.product_id as id,
      p.name_ar,
      p.name_en,
      tp.views_count
    FROM t_products tp
    JOIN public.products p ON p.id = tp.product_id
    ORDER BY tp.views_count DESC
  ),
  search_stats AS (
    SELECT 
      count(*) as total_searches,
      count(*) FILTER (WHERE results_count = 0) as zero_results
    FROM public.search_logs
    WHERE created_at >= since
  ),
  t_queries AS (
    SELECT lower(trim(query)) as q, count(*) as c
    FROM public.search_logs
    WHERE created_at >= since AND query IS NOT NULL AND trim(query) != ''
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'unique_sessions', (SELECT COALESCE(c, 0) FROM uniq_sess),
    'referral_clicks', (SELECT COALESCE(c, 0) FROM ref_clicks),
    'daily_visits', COALESCE((SELECT jsonb_agg(row_to_json(d)) FROM d_visits d), '[]'::jsonb),
    'top_referrers', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM t_refs r), '[]'::jsonb),
    'top_pages', COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM t_pages p), '[]'::jsonb),
    'top_events', COALESCE((SELECT jsonb_agg(row_to_json(e)) FROM t_events e), '[]'::jsonb),
    'total_product_views', (SELECT COALESCE(c, 0) FROM t_total_product_views),
    'top_products', COALESCE((SELECT jsonb_agg(row_to_json(pe)) FROM t_products_enriched pe), '[]'::jsonb),
    'total_searches', (SELECT COALESCE(total_searches, 0) FROM search_stats),
    'zero_results', (SELECT COALESCE(zero_results, 0) FROM search_stats),
    'top_queries', COALESCE((SELECT jsonb_agg(row_to_json(q)) FROM t_queries q), '[]'::jsonb)
  ) INTO res;
  
  RETURN res;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_store_analytics_data_v1(since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  res jsonb;
  orders_data jsonb;
  items_data jsonb;
  customers_count bigint;
  sessions_count bigint;
  carts_data jsonb;
BEGIN
  -- Orders data
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'total', total,
      'refunded_amount', refunded_amount,
      'status', status,
      'payment_status', payment_status,
      'payment_method', payment_method,
      'created_at', created_at
    )
  ), '[]'::jsonb) INTO orders_data
  FROM public.orders
  WHERE created_at >= since;

  -- Items data (only for paid orders)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'product_name', i.product_name,
      'qty', i.qty
    )
  ), '[]'::jsonb) INTO items_data
  FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  WHERE o.created_at >= since AND o.payment_status = 'paid';

  -- Customers count
  SELECT count(*) INTO customers_count
  FROM public.profiles
  WHERE created_at >= since;

  -- Unique sessions count (excluding internal tools)
  SELECT count(DISTINCT session_id) INTO sessions_count
  FROM public.analytics_events
  WHERE created_at >= since AND session_id IS NOT NULL
    AND (referrer IS NULL OR (
         referrer NOT ILIKE '%lovable.dev' 
         AND referrer NOT ILIKE '%lovableproject.com' 
         AND referrer NOT ILIKE '%lovable.app'));

  -- Abandoned carts data
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'email', email,
      'phone', phone,
      'stage', stage,
      'subtotal', subtotal,
      'updated_at', updated_at,
      'converted', converted,
      'reached_checkout', reached_checkout,
      'abandonment_reason', abandonment_reason
    )
  ), '[]'::jsonb) INTO carts_data
  FROM public.abandoned_carts
  WHERE updated_at >= since;

  res := jsonb_build_object(
    'orders', orders_data,
    'items', items_data,
    'customers_count', customers_count,
    'sessions_count', sessions_count,
    'carts', carts_data
  );

  RETURN res;
END;
$$;
