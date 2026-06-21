ALTER TABLE public.cms_pages DROP CONSTRAINT IF EXISTS cms_pages_type_check;
ALTER TABLE public.cms_pages ADD CONSTRAINT cms_pages_type_check
  CHECK (type = ANY (ARRAY['home','about','contact','custom','landing','product','product_card','category','checkout','header','footer']));