CREATE OR REPLACE FUNCTION public.get_site_analytics_v1(since timestamp with time zone, host_domain text DEFAULT 'lppme.com')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  res jsonb;
BEGIN
  WITH base AS (
    SELECT
      session_id,
      created_at,
      event_name,
      path,
      metadata,
      user_agent,
      CASE
        WHEN referrer LIKE 'http%' THEN lower(replace(split_part(substring(referrer from '^https?://([^/]+)'), ':', 1), 'www.', ''))
        ELSE NULL
      END AS ref_domain
    FROM public.analytics_events
    WHERE created_at >= since
      AND session_id IS NOT NULL
  ),
  clean AS (
    SELECT * FROM base
    WHERE ref_domain IS NULL
       OR (ref_domain NOT ILIKE '%lovable.dev'
           AND ref_domain NOT ILIKE '%lovableproject.com'
           AND ref_domain NOT ILIKE '%lovable.app')
  ),
  gapped AS (
    SELECT *,
      CASE WHEN created_at - lag(created_at) OVER (PARTITION BY session_id ORDER BY created_at) > interval '30 minutes'
           OR lag(created_at) OVER (PARTITION BY session_id ORDER BY created_at) IS NULL
        THEN 1 ELSE 0 END AS new_visit
    FROM clean
  ),
  visited AS (
    SELECT *,
      session_id || ':' || sum(new_visit) OVER (PARTITION BY session_id ORDER BY created_at ROWS UNBOUNDED PRECEDING)::text AS visit_id
    FROM gapped
  ),
  visits AS (
    SELECT
      visit_id,
      session_id,
      min(created_at) AS started_at,
      max(created_at) AS ended_at,
      count(*) FILTER (WHERE event_name = 'page_view') AS pageviews,
      (array_agg(ref_domain ORDER BY created_at) FILTER (WHERE ref_domain IS NOT NULL))[1] AS entry_ref,
      (array_agg(user_agent ORDER BY created_at))[1] AS ua
    FROM visited
    GROUP BY 1, 2
  ),
  visit_stats AS (
    SELECT
      count(*)::bigint AS total_visits,
      count(DISTINCT session_id)::bigint AS unique_visitors,
      COALESCE(sum(pageviews), 0)::bigint AS total_pageviews,
      COALESCE(round(avg(pageviews)::numeric, 2), 0) AS views_per_visit,
      COALESCE(round(avg(EXTRACT(EPOCH FROM (ended_at - started_at)))::numeric, 0), 0) AS avg_duration_sec,
      COALESCE(round(100.0 * count(*) FILTER (WHERE pageviews <= 1) / NULLIF(count(*), 0), 0), 0) AS bounce_rate
    FROM visits
  ),
  d_visits AS (
    SELECT to_char(started_at, 'YYYY-MM-DD') AS date,
           count(*)::bigint AS visits,
           COALESCE(sum(pageviews), 0)::bigint AS pageviews
    FROM visits GROUP BY 1 ORDER BY 1
  ),
  t_refs AS (
    SELECT entry_ref AS source, count(*)::bigint AS count
    FROM visits
    WHERE entry_ref IS NOT NULL AND entry_ref <> ''
      AND entry_ref NOT ILIKE '%' || host_domain || '%'
      AND entry_ref NOT ILIKE '%lppme.com'
      AND entry_ref NOT ILIKE '%trendify.sa'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ),
  direct_visits AS (
    SELECT count(*)::bigint AS c FROM visits
    WHERE entry_ref IS NULL OR entry_ref = ''
       OR entry_ref ILIKE '%' || host_domain || '%'
       OR entry_ref ILIKE '%lppme.com' OR entry_ref ILIKE '%trendify.sa'
  ),
  devices AS (
    SELECT CASE
             WHEN ua IS NULL THEN 'unknown'
             WHEN ua ~* 'ipad|tablet' THEN 'tablet'
             WHEN ua ~* 'mobi|android|iphone' THEN 'mobile'
             ELSE 'desktop'
           END AS device,
           count(*)::bigint AS count
    FROM visits GROUP BY 1 ORDER BY 2 DESC
  ),
  t_pages AS (
    SELECT path,
           count(*) FILTER (WHERE event_name = 'page_view')::bigint AS count,
           count(DISTINCT visit_id)::bigint AS visitors
    FROM visited
    WHERE path IS NOT NULL AND path <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ),
  t_events AS (
    SELECT event_name AS name, count(*)::bigint AS count
    FROM visited
    WHERE event_name IS NOT NULL AND event_name <> '' AND event_name <> 'page_view'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ),
  t_products AS (
    SELECT nullif(metadata->>'product_id','')::uuid AS product_id, count(*)::bigint AS views_count
    FROM visited
    WHERE event_name = 'product_view'
      AND nullif(metadata->>'product_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  t_products_events AS (
    SELECT p.id, p.name_ar, p.name_en, tp.views_count
    FROM t_products tp JOIN public.products p ON p.id = tp.product_id
    ORDER BY tp.views_count DESC
  ),
  t_products_paths AS (
    SELECT split_part(path, '/', 3) AS slug, count(*)::bigint AS views_count
    FROM visited
    WHERE event_name = 'page_view' AND path LIKE '/product/%'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  t_products_slugs AS (
    SELECT p.id, p.name_ar, p.name_en, tpp.views_count
    FROM t_products_paths tpp JOIN public.products p ON p.slug = tpp.slug
    ORDER BY tpp.views_count DESC
  ),
  product_view_total AS (
    SELECT count(*)::bigint AS c FROM visited
    WHERE event_name = 'product_view' OR (event_name = 'page_view' AND path LIKE '/product/%')
  ),
  search_stats AS (
    SELECT count(*)::bigint AS total_searches,
           count(*) FILTER (WHERE results_count = 0)::bigint AS zero_results
    FROM public.search_logs WHERE created_at >= since
  ),
  t_queries AS (
    SELECT lower(trim(query)) AS q, count(*)::bigint AS c
    FROM public.search_logs
    WHERE created_at >= since AND query IS NOT NULL AND trim(query) <> ''
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  )
  SELECT jsonb_build_object(
    'unique_sessions', (SELECT total_visits FROM visit_stats),
    'unique_visitors', (SELECT unique_visitors FROM visit_stats),
    'total_pageviews', (SELECT total_pageviews FROM visit_stats),
    'views_per_visit', (SELECT views_per_visit FROM visit_stats),
    'avg_duration_sec', (SELECT avg_duration_sec FROM visit_stats),
    'bounce_rate', (SELECT bounce_rate FROM visit_stats),
    'referral_clicks', (SELECT COALESCE(sum(tr.count), 0) FROM t_refs tr),
    'direct_visits', (SELECT c FROM direct_visits),
    'devices', COALESCE((SELECT jsonb_agg(to_jsonb(dv)) FROM devices dv), '[]'::jsonb),
    'daily_visits', COALESCE((SELECT jsonb_agg(to_jsonb(dd)) FROM d_visits dd), '[]'::jsonb),
    'top_referrers', COALESCE((SELECT jsonb_agg(to_jsonb(rr)) FROM t_refs rr), '[]'::jsonb),
    'top_pages', COALESCE((SELECT jsonb_agg(to_jsonb(pp)) FROM t_pages pp), '[]'::jsonb),
    'top_events', COALESCE((SELECT jsonb_agg(to_jsonb(ee)) FROM t_events ee), '[]'::jsonb),
    'total_product_views', (SELECT c FROM product_view_total),
    'top_products', COALESCE(
        NULLIF((SELECT jsonb_agg(to_jsonb(pe)) FROM t_products_events pe), '[]'::jsonb),
        COALESCE((SELECT jsonb_agg(to_jsonb(ps)) FROM t_products_slugs ps), '[]'::jsonb)
      ),
    'total_searches', (SELECT total_searches FROM search_stats),
    'zero_results', (SELECT zero_results FROM search_stats),
    'top_queries', COALESCE((SELECT jsonb_agg(to_jsonb(qq)) FROM t_queries qq), '[]'::jsonb)
  ) INTO res;

  RETURN res;
END;
$fn$;