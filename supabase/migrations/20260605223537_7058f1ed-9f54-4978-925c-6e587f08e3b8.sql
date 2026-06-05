
-- 1) Lock down write access on storefront/catalog tables to admin/staff/manager only.
--    Drop the broad "authenticated can do anything" policies.

DROP POLICY IF EXISTS product_variants_write ON public.product_variants;
DROP POLICY IF EXISTS product_attributes_write ON public.product_attributes;
DROP POLICY IF EXISTS product_categories_write ON public.product_categories;
DROP POLICY IF EXISTS header_nav_write ON public.header_nav_items;
DROP POLICY IF EXISTS shop_by_category_write ON public.shop_by_category_items;
DROP POLICY IF EXISTS season_picks_write ON public.season_picks;

-- product_variants already has "Admins manage variants" — nothing more to add.

CREATE POLICY "Admins manage product_attributes"
  ON public.product_attributes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins manage product_categories"
  ON public.product_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins manage header_nav_items"
  ON public.header_nav_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins manage shop_by_category_items"
  ON public.shop_by_category_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins manage season_picks"
  ON public.season_picks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'manager'));

-- 2) order_items INSERT must verify ownership of the parent order.

DROP POLICY IF EXISTS "Insert order items" ON public.order_items;

CREATE POLICY "Insert order items by owner or staff"
  ON public.order_items FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'staff')
          OR public.has_role(auth.uid(),'manager')
        )
    )
  );

-- 3) Storage: return-photos upload must be scoped to the uploader's own folder.

DROP POLICY IF EXISTS "Auth upload return photos" ON storage.objects;

CREATE POLICY "Auth upload return photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'return-photos'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 4) shipping_carriers: hide sensitive credential columns from public reads.
--    Switch anon from table-level SELECT to explicit safe-column grants.

REVOKE SELECT ON public.shipping_carriers FROM anon;
GRANT SELECT (
  id, code, name_ar, name_en, carrier_type, logo_url, is_active,
  supports_cod, supports_international, supports_tracking, supports_webhook,
  default_delivery_days_min, default_delivery_days_max, display_order,
  created_at, updated_at
) ON public.shipping_carriers TO anon;

-- Also restrict the same columns for non-admin authenticated users.
-- Admins read api_credentials through a SECURITY DEFINER server path (admin UI), not via RLS-bound client.
REVOKE SELECT (api_credentials, webhook_secret_name) ON public.shipping_carriers FROM authenticated;

-- 5) Mark remaining views as security_invoker so they respect the caller's RLS.

ALTER VIEW public.product_options_public  SET (security_invoker = true);
ALTER VIEW public.product_variants_public SET (security_invoker = true);
