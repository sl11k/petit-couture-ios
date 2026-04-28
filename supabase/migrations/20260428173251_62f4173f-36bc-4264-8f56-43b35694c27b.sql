
-- جدول جدولة التقارير
CREATE TABLE public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_key text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily',
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage schedules" ON public.report_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER report_schedules_touch
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- جدول سجل تشغيل التقارير
CREATE TABLE public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.report_schedules(id) ON DELETE SET NULL,
  report_key text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows_count integer DEFAULT 0,
  error_message text,
  triggered_by uuid,
  triggered_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read report runs" ON public.report_runs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins insert report runs" ON public.report_runs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX idx_report_runs_created ON public.report_runs(created_at DESC);
CREATE INDEX idx_report_schedules_next ON public.report_schedules(next_run_at) WHERE is_enabled = true;
