CREATE TABLE public.live_overrides_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  override_id UUID REFERENCES public.live_overrides(id) ON DELETE SET NULL,
  page_path TEXT NOT NULL,
  selector TEXT NOT NULL,
  prop TEXT NOT NULL,
  lang TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('draft','publish')),
  old_value JSONB,
  new_value JSONB,
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loh_path_created ON public.live_overrides_history(page_path, created_at DESC);
CREATE INDEX idx_loh_override ON public.live_overrides_history(override_id);

GRANT SELECT, INSERT ON public.live_overrides_history TO authenticated;
GRANT ALL ON public.live_overrides_history TO service_role;
ALTER TABLE public.live_overrides_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read history" ON public.live_overrides_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'content_manager') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'store_manager'));

CREATE POLICY "Admins can insert history" ON public.live_overrides_history FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'content_manager') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'store_manager'));

CREATE OR REPLACE FUNCTION public.log_live_override_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
  _kind text;
  _old jsonb;
  _new jsonb;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  -- Detect publish: published_value changed
  IF TG_OP = 'INSERT' OR (NEW.published_value IS DISTINCT FROM COALESCE(OLD.published_value, 'null'::jsonb)) THEN
    IF NEW.published_value IS NOT NULL THEN
      _kind := 'publish';
      _old := CASE WHEN TG_OP='UPDATE' THEN OLD.published_value ELSE NULL END;
      _new := NEW.published_value;
      INSERT INTO public.live_overrides_history(override_id,page_path,selector,prop,lang,change_kind,old_value,new_value,actor_id,actor_email)
      VALUES (NEW.id, NEW.page_path, NEW.selector, NEW.prop, NEW.lang, _kind, _old, _new, auth.uid(), _email);
    END IF;
  END IF;

  -- Detect draft change: draft_value changed
  IF TG_OP = 'INSERT' OR (NEW.draft_value IS DISTINCT FROM COALESCE(OLD.draft_value, 'null'::jsonb)) THEN
    IF NEW.draft_value IS NOT NULL THEN
      _kind := 'draft';
      _old := CASE WHEN TG_OP='UPDATE' THEN OLD.draft_value ELSE NULL END;
      _new := NEW.draft_value;
      INSERT INTO public.live_overrides_history(override_id,page_path,selector,prop,lang,change_kind,old_value,new_value,actor_id,actor_email)
      VALUES (NEW.id, NEW.page_path, NEW.selector, NEW.prop, NEW.lang, _kind, _old, _new, auth.uid(), _email);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_live_override_change
AFTER INSERT OR UPDATE ON public.live_overrides
FOR EACH ROW EXECUTE FUNCTION public.log_live_override_change();