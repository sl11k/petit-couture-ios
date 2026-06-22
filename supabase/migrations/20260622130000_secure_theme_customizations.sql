-- Restrict visual theme publishing to storefront administrators.
-- The original bootstrap policy allowed every authenticated customer to write;
-- this replacement keeps public reads while limiting all mutations.
drop policy if exists "authenticated users manage theme customizations"
  on public.theme_customizations;

create policy "storefront managers manage theme customizations"
on public.theme_customizations
for all
to authenticated
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
