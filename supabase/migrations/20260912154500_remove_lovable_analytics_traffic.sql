-- Remove preview/editor traffic only. No commerce or customer records are touched.
WITH preview_sessions AS (
  SELECT DISTINCT session_id
  FROM public.analytics_events
  WHERE lower(coalesce(referrer, '')) LIKE '%lovableproject.com%'
     OR lower(coalesce(referrer, '')) LIKE '%lovable.dev%'
     OR lower(coalesce(metadata->>'host', '')) LIKE '%lovableproject.com%'
     OR lower(coalesce(metadata->>'host', '')) LIKE '%lovable.dev%'
     OR lower(coalesce(metadata->>'hostname', '')) LIKE '%lovableproject.com%'
     OR lower(coalesce(metadata->>'hostname', '')) LIKE '%lovable.dev%'
)
DELETE FROM public.analytics_events e
USING preview_sessions p
WHERE e.session_id = p.session_id;
