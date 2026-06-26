alter table public.products
  add column if not exists delivery_estimate_ar text,
  add column if not exists delivery_estimate_en text,
  add column if not exists shipping_policy_ar text,
  add column if not exists shipping_policy_en text,
  add column if not exists return_policy_ar text,
  add column if not exists return_policy_en text;

comment on column public.products.delivery_estimate_ar is 'Arabic product-level delivery estimate shown on the product page.';
comment on column public.products.delivery_estimate_en is 'English product-level delivery estimate shown on the product page.';
comment on column public.products.shipping_policy_ar is 'Arabic product-level shipping policy text shown on the product page.';
comment on column public.products.shipping_policy_en is 'English product-level shipping policy text shown on the product page.';
comment on column public.products.return_policy_ar is 'Arabic product-level return policy text shown on the product page.';
comment on column public.products.return_policy_en is 'English product-level return policy text shown on the product page.';
