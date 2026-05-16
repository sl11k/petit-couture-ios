
-- Create new media buckets with 200MB size limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-media',  'product-media',  true, 209715200, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml','video/mp4','video/webm','video/quicktime']),
  ('category-media', 'category-media', true, 209715200, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']),
  ('banner-media',   'banner-media',   true, 209715200, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml','video/mp4','video/webm']),
  ('content-media',  'content-media',  true, 209715200, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml','video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helper: which roles may write media
-- Reuses public.has_role; admin/manager/staff/super_admin can write

-- Public read for all four buckets
CREATE POLICY "Public read media buckets"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-media','category-media','banner-media','content-media'));

-- Admin upload
CREATE POLICY "Admins upload media buckets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('product-media','category-media','banner-media','content-media')
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
);

-- Admin update
CREATE POLICY "Admins update media buckets"
ON storage.objects FOR UPDATE
USING (
  bucket_id IN ('product-media','category-media','banner-media','content-media')
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
);

-- Admin delete
CREATE POLICY "Admins delete media buckets"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('product-media','category-media','banner-media','content-media')
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
);
