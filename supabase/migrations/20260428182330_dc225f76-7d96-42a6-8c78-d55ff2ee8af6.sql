
-- Hot-query indexes
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_created ON public.orders (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON public.search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_sales ON public.products (is_active, sales_count DESC);

-- Web Vitals / performance monitoring
CREATE TABLE IF NOT EXISTS public.perf_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,           -- LCP | CLS | INP | TTFB | FCP | LongTask | RouteChange
  value numeric NOT NULL,         -- ms (or unit-less for CLS)
  rating text,                    -- good | needs-improvement | poor
  page text,                      -- pathname
  navigation_type text,           -- navigate | reload | back-forward
  device text,                    -- mobile | desktop
  connection text,                -- 4g | 3g | wifi etc
  user_id uuid,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_created ON public.perf_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_metric ON public.perf_metrics (metric, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_page ON public.perf_metrics (page);

ALTER TABLE public.perf_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record metrics" ON public.perf_metrics;
CREATE POLICY "Anyone can record metrics"
  ON public.perf_metrics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read metrics" ON public.perf_metrics;
CREATE POLICY "Admins can read metrics"
  ON public.perf_metrics FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'reports.view'::text)
  );
