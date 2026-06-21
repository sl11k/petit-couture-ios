CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.live_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  selector TEXT NOT NULL,
  prop TEXT NOT NULL CHECK (prop IN ('text','html','src','href','style')),
  lang TEXT NOT NULL DEFAULT 'ar',
  draft_value JSONB,
  published_value JSONB,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (page_path, selector, prop, lang)
);
CREATE INDEX idx_live_overrides_path ON public.live_overrides(page_path);

GRANT SELECT ON public.live_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_overrides TO authenticated;
GRANT ALL ON public.live_overrides TO service_role;
ALTER TABLE public.live_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published overrides" ON public.live_overrides FOR SELECT USING (published_value IS NOT NULL);
CREATE POLICY "Admins can read all overrides" ON public.live_overrides FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'content_manager') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'store_manager'));
CREATE POLICY "Admins can insert overrides" ON public.live_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'content_manager') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'store_manager'));
CREATE POLICY "Admins can update overrides" ON public.live_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'content_manager') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'store_manager'));
CREATE POLICY "Admins can delete overrides" ON public.live_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_live_overrides_updated_at BEFORE UPDATE ON public.live_overrides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();