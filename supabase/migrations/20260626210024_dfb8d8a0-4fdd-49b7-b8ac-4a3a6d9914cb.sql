
UPDATE public.live_overrides
SET draft_value = to_jsonb('+96655 740 4827'::text),
    published_value = to_jsonb('+96655 740 4827'::text),
    updated_at = now()
WHERE prop = 'text'
  AND (draft_value::text LIKE '%50 000 0000%' OR published_value::text LIKE '%50 000 0000%'
    OR draft_value::text LIKE '%556943318%' OR published_value::text LIKE '%556943318%');

UPDATE public.live_overrides
SET draft_value = to_jsonb('tel:+966557404827'::text),
    published_value = to_jsonb('tel:+966557404827'::text),
    updated_at = now()
WHERE prop = 'href'
  AND draft_value::text LIKE 'tel:%'
  AND (draft_value::text LIKE '%50 000 0000%' OR draft_value::text LIKE '%556943318%'
    OR published_value::text LIKE '%50 000 0000%' OR published_value::text LIKE '%556943318%');
