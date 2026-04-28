
-- Enable trigram extension for fuzzy/typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add search vector column to products (bilingual)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to keep search_vector synced
CREATE OR REPLACE FUNCTION public.products_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name_ar,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name_en,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.brand,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.sku,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description_ar,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description_en,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.description_ar,'')), 'D') ||
    setweight(to_tsvector('simple', coalesce(NEW.description_en,'')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_search_vector ON public.products;
CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE OF name_ar, name_en, brand, sku, short_description_ar, short_description_en, description_ar, description_en
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_search_vector_update();

-- Backfill existing rows
UPDATE public.products SET search_vector =
  setweight(to_tsvector('simple', coalesce(name_ar,'')), 'A') ||
  setweight(to_tsvector('simple', coalesce(name_en,'')), 'A') ||
  setweight(to_tsvector('simple', coalesce(brand,'')), 'B') ||
  setweight(to_tsvector('simple', coalesce(sku,'')), 'B') ||
  setweight(to_tsvector('simple', coalesce(short_description_ar,'')), 'C') ||
  setweight(to_tsvector('simple', coalesce(short_description_en,'')), 'C') ||
  setweight(to_tsvector('simple', coalesce(description_ar,'')), 'D') ||
  setweight(to_tsvector('simple', coalesce(description_en,'')), 'D');

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON public.products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_name_ar_trgm ON public.products USING GIN(name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_en_trgm ON public.products USING GIN(name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON public.products USING GIN(brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_ar_trgm ON public.categories USING GIN(name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_en_trgm ON public.categories USING GIN(name_en gin_trgm_ops);

-- Add views_count column for "most viewed" sorting (if not exists)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

-- RPC for autocomplete suggestions (typo-tolerant)
CREATE OR REPLACE FUNCTION public.search_autocomplete(_q text, _limit int DEFAULT 8)
RETURNS TABLE (
  kind text,
  id uuid,
  label_ar text,
  label_en text,
  slug text,
  image_url text,
  price numeric,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT lower(trim(_q)) AS query)
  -- Products by full-text + trigram
  (SELECT 'product'::text AS kind,
          p.id, p.name_ar AS label_ar, p.name_en AS label_en,
          p.slug, p.image_url, p.price,
          GREATEST(
            similarity(lower(coalesce(p.name_ar,'')), (SELECT query FROM q)),
            similarity(lower(coalesce(p.name_en,'')), (SELECT query FROM q))
          ) AS similarity
   FROM public.products p, q
   WHERE p.is_active = true
     AND (
       p.search_vector @@ plainto_tsquery('simple', q.query)
       OR lower(p.name_ar) % q.query
       OR lower(p.name_en) % q.query
       OR lower(coalesce(p.brand,'')) % q.query
     )
   ORDER BY similarity DESC NULLS LAST, p.sales_count DESC
   LIMIT _limit)
  UNION ALL
  -- Categories
  (SELECT 'category'::text AS kind,
          c.id, c.name_ar, c.name_en, c.slug, c.image_url, NULL::numeric,
          GREATEST(
            similarity(lower(coalesce(c.name_ar,'')), (SELECT query FROM q)),
            similarity(lower(coalesce(c.name_en,'')), (SELECT query FROM q))
          ) AS similarity
   FROM public.categories c, q
   WHERE c.is_active = true
     AND (lower(c.name_ar) % q.query OR lower(c.name_en) % q.query)
   ORDER BY similarity DESC NULLS LAST
   LIMIT 4);
$$;

-- RPC for spell suggestion (closest term from product names + synonyms)
CREATE OR REPLACE FUNCTION public.search_spell_suggest(_q text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT term FROM (
    SELECT name_ar AS term, similarity(lower(name_ar), lower(_q)) AS sim FROM public.products WHERE is_active = true
    UNION ALL
    SELECT name_en AS term, similarity(lower(name_en), lower(_q)) AS sim FROM public.products WHERE is_active = true
    UNION ALL
    SELECT synonym AS term, similarity(lower(synonym), lower(_q)) AS sim FROM public.search_synonyms
    UNION ALL
    SELECT term AS term, similarity(lower(term), lower(_q)) AS sim FROM public.search_synonyms
  ) s
  WHERE sim > 0.3 AND lower(term) <> lower(_q)
  ORDER BY sim DESC
  LIMIT 1;
$$;

-- RPC to increment product view count
CREATE OR REPLACE FUNCTION public.increment_product_views(_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products SET views_count = views_count + 1 WHERE id = _product_id;
$$;
