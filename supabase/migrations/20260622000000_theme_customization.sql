-- OPTIONAL: cloud persistence for the visual theme builder.
-- The current feature works immediately with browser localStorage; run this migration
-- manually through the Supabase dashboard only when cross-device/admin sync is desired.
create table if not exists public.theme_customizations (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'storefront' unique,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.theme_customizations enable row level security;

-- Published theme configuration is readable by the storefront.
drop policy if exists "theme customizations are publicly readable" on public.theme_customizations;
create policy "theme customizations are publicly readable"
on public.theme_customizations for select using (true);

-- Only storefront administrators may publish visual themes.
drop policy if exists "authenticated users manage theme customizations" on public.theme_customizations;
drop policy if exists "storefront managers manage theme customizations" on public.theme_customizations;
create policy "storefront managers manage theme customizations"
on public.theme_customizations for all to authenticated
using (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'store_manager'::public.app_role)
  or public.has_role(auth.uid(), 'content_manager'::public.app_role)
  or public.has_permission(auth.uid(), 'storefront.manage')
)
with check (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'store_manager'::public.app_role)
  or public.has_role(auth.uid(), 'content_manager'::public.app_role)
  or public.has_permission(auth.uid(), 'storefront.manage')
);

create index if not exists theme_customizations_updated_at_idx
on public.theme_customizations (updated_at desc);
