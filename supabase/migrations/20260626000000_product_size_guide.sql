alter table public.products
  add column if not exists size_guide_image_url text,
  add column if not exists size_guide_content_ar text,
  add column if not exists size_guide_content_en text;

comment on column public.products.size_guide_image_url is
  'Optional product size guide image shown clearly in the customer product page size guide modal.';

comment on column public.products.size_guide_content_ar is
  'Optional Arabic product size guide notes.';

comment on column public.products.size_guide_content_en is
  'Optional English product size guide notes.';
