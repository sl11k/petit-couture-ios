CREATE OR REPLACE FUNCTION public.get_site_analytics_v1(since timestamp with time zone, host_domain text DEFAULT 'lppme.com'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (array_agg(user_agent ORDER BY created_at))[1] AS ua,
      (array_agg(path ORDER BY created_at) FILTER (WHERE event_name = 'page_view' AND path IS NOT NULL))[1] AS entry_path,
      (array_agg(path ORDER BY created_at DESC) FILTER (WHERE event_name = 'page_view' AND path IS NOT NULL))[1] AS exit_path,
      (array_agg(nullif(metadata->>'country','') ORDER BY created_at) FILTER (WHERE nullif(metadata->>'country','') IS NOT NULL))[1] AS country,
      (array_agg(nullif(metadata->>'lang','') ORDER BY created_at) FILTER (WHERE nullif(metadata->>'lang','') IS NOT NULL))[1] AS lang,
      (array_agg(nullif(metadata->>'utm_source','') ORDER BY created_at) FILTER (WHERE nullif(metadata->>'utm_source','') IS NOT NULL))[1] AS utm_source,
      (array_agg(nullif(metadata->>'utm_medium','') ORDER BY created_at) FILTER (WHERE nullif(metadata->>'utm_medium','') IS NOT NULL))[1] AS utm_medium,
      (array_agg(nullif(metadata->>'utm_campaign','') ORDER BY created_at) FILTER (WHERE nullif(metadata->>'utm_campaign','') IS NOT NULL))[1] AS utm_campaign
    FROM visited
    GROUP BY 1, 2
  ),
  vis2 AS (
    SELECT *,
      CASE
        WHEN ua IS NULL THEN 'unknown'
        WHEN ua ~* 'ipad|tablet' THEN 'tablet'
        WHEN ua ~* 'mobi|android|iphone' THEN 'mobile'
        ELSE 'desktop'
      END AS device,
      CASE
        WHEN ua IS NULL THEN 'unknown'
        WHEN ua ~* 'edg/' THEN 'Edge'
        WHEN ua ~* 'opr/|opera' THEN 'Opera'
        WHEN ua ~* 'samsungbrowser' THEN 'Samsung Internet'
        WHEN ua ~* 'fban|fbav|instagram' THEN 'In-app (Meta)'
        WHEN ua ~* 'chrome|crios' THEN 'Chrome'
        WHEN ua ~* 'firefox|fxios' THEN 'Firefox'
        WHEN ua ~* 'safari' THEN 'Safari'
        ELSE 'Other'
      END AS browser,
      CASE
        WHEN ua IS NULL THEN 'unknown'
        WHEN ua ~* 'iphone|ipad|ipod|ios' THEN 'iOS'
        WHEN ua ~* 'android' THEN 'Android'
        WHEN ua ~* 'windows' THEN 'Windows'
        WHEN ua ~* 'mac os|macintosh' THEN 'macOS'
        WHEN ua ~* 'linux' THEN 'Linux'
        ELSE 'Other'
      END AS os,
      CASE
        WHEN entry_ref IS NULL OR entry_ref = ''
          OR entry_ref ILIKE '%' || host_domain || '%'
          OR entry_ref ILIKE '%lppme.com' OR entry_ref ILIKE '%trendify.sa'
        THEN 'Direct' ELSE entry_ref
      END AS source
    FROM visits
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
    SELECT to_char(started_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS date,
           count(*)::bigint AS visits,
           COALESCE(sum(pageviews), 0)::bigint AS pageviews
    FROM visits GROUP BY 1 ORDER BY 1
  ),
  t_sources AS (
    SELECT source, count(*)::bigint AS visitors,
           COALESCE(sum(pageviews),0)::bigint AS pageviews,
           COALESCE(round(100.0 * count(*) FILTER (WHERE pageviews <= 1) / NULLIF(count(*),0), 0), 0) AS bounce_rate
    FROM vis2 GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ),
  t_refs AS (
    SELECT source, visitors AS count FROM t_sources WHERE source <> 'Direct' ORDER BY visitors DESC LIMIT 15
  ),
  direct_visits AS (
    SELECT COALESCE((SELECT visitors FROM t_sources WHERE source = 'Direct'), 0)::bigint AS c
  ),
  devices AS (
    SELECT device, count(*)::bigint AS count FROM vis2 GROUP BY 1 ORDER BY 2 DESC
  ),
  browsers AS (
    SELECT browser AS name, count(*)::bigint AS count FROM vis2 GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  oses AS (
    SELECT os AS name, count(*)::bigint AS count FROM vis2 GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  countries AS (
    SELECT COALESCE(country, 'unknown') AS code, count(*)::bigint AS count
    FROM vis2 GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  ),
  langs AS (
    SELECT COALESCE(lang, 'unknown') AS code, count(*)::bigint AS count
    FROM vis2 GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  entry_pages AS (
    SELECT entry_path AS path, count(*)::bigint AS visitors,
           COALESCE(round(100.0 * count(*) FILTER (WHERE pageviews <= 1) / NULLIF(count(*),0), 0), 0) AS bounce_rate
    FROM vis2 WHERE entry_path IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ),
  exit_pages AS (
    SELECT exit_path AS path, count(*)::bigint AS visitors
    FROM vis2 WHERE exit_path IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  ),
  utm_sources AS (
    SELECT utm_source AS name, count(*)::bigint AS count FROM vis2 WHERE utm_source IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  utm_mediums AS (
    SELECT utm_medium AS name, count(*)::bigint AS count FROM vis2 WHERE utm_medium IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  utm_campaigns AS (
    SELECT utm_campaign AS name, count(*)::bigint AS count FROM vis2 WHERE utm_campaign IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  t_pages AS (
    SELECT path,
           count(*) FILTER (WHERE event_name = 'page_view')::bigint AS count,
           count(DISTINCT visit_id)::bigint AS visitors
    FROM visited
    WHERE path IS NOT NULL AND path <> ''
    GROUP BY 1 ORDER BY 3 DESC LIMIT 20
  ),
  t_events AS (
    SELECT event_name AS name, count(*)::bigint AS count, count(DISTINCT visit_id)::bigint AS visitors
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
  ),
  funnel AS (
    SELECT
      count(DISTINCT visit_id) FILTER (WHERE event_name = 'page_view' AND path LIKE '/product/%')::bigint AS product_visits,
      count(DISTINCT visit_id) FILTER (WHERE event_name IN ('add_to_cart','bag_add'))::bigint AS cart_visits,
      count(DISTINCT visit_id) FILTER (WHERE event_name = 'page_view' AND path LIKE '/checkout%')::bigint AS checkout_visits,
      count(DISTINCT visit_id) FILTER (WHERE event_name = 'page_view' AND path LIKE '/order-confirmation%')::bigint AS purchase_visits
    FROM visited
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
    'browsers', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM browsers b), '[]'::jsonb),
    'operating_systems', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM oses o), '[]'::jsonb),
    'countries', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM countries c), '[]'::jsonb),
    'languages', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM langs l), '[]'::jsonb),
    'entry_pages', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM entry_pages e), '[]'::jsonb),
    'exit_pages', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM exit_pages x), '[]'::jsonb),
    'utm_sources', COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM utm_sources u), '[]'::jsonb),
    'utm_mediums', COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM utm_mediums u), '[]'::jsonb),
    'utm_campaigns', COALESCE((SELECT jsonb_agg(to_jsonb(u)) FROM utm_campaigns u), '[]'::jsonb),
    'sources', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM t_sources s), '[]'::jsonb),
    'daily_visits', COALESCE((SELECT jsonb_agg(to_jsonb(dd)) FROM d_visits dd), '[]'::jsonb),
    'top_referrers', COALESCE((SELECT jsonb_agg(to_jsonb(rr)) FROM t_refs rr), '[]'::jsonb),
    'top_pages', COALESCE((SELECT jsonb_agg(to_jsonb(pp)) FROM t_pages pp), '[]'::jsonb),
    'top_events', COALESCE((SELECT jsonb_agg(to_jsonb(ee)) FROM t_events ee), '[]'::jsonb),
    'funnel', (SELECT to_jsonb(f) FROM funnel f),
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
$function$;