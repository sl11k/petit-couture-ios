CREATE TABLE IF NOT EXISTS public.tracking_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  label text,
  pixel_id text,
  custom_script text,
  enabled boolean NOT NULL DEFAULT true,
  placement text NOT NULL DEFAULT 'head',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tracking_pixels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_pixels TO authenticated;
GRANT ALL ON public.tracking_pixels TO service_role;

ALTER TABLE public.tracking_pixels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracking_pixels_public_read" ON public.tracking_pixels;
CREATE POLICY "tracking_pixels_public_read" ON public.tracking_pixels
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tracking_pixels_admin_write" ON public.tracking_pixels;
CREATE POLICY "tracking_pixels_admin_write" ON public.tracking_pixels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_manager'));

DROP TRIGGER IF EXISTS tracking_pixels_touch ON public.tracking_pixels;
CREATE TRIGGER tracking_pixels_touch BEFORE UPDATE ON public.tracking_pixels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tracking_pixels (provider, label, pixel_id, enabled, sort_order)
SELECT 'tiktok', 'TikTok Pixel', 'D9JMJRJC77U1QT0MFB50', true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.tracking_pixels WHERE provider = 'tiktok');