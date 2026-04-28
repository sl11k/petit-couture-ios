ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'cart',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS recovery_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS recovered_order_id uuid,
  ADD COLUMN IF NOT EXISTS recovery_coupon_code text,
  ADD COLUMN IF NOT EXISTS abandonment_reason text,
  ADD COLUMN IF NOT EXISTS contact_status text NOT NULL DEFAULT 'not_contacted',
  ADD COLUMN IF NOT EXISTS contact_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_carts_stage ON public.abandoned_carts(stage);
CREATE INDEX IF NOT EXISTS idx_carts_converted_updated ON public.abandoned_carts(converted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_carts_recovery_token ON public.abandoned_carts(recovery_token);

CREATE TABLE IF NOT EXISTS public.cart_recovery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.abandoned_carts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  message text,
  coupon_code text,
  actor_id uuid,
  actor_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_cart ON public.cart_recovery_attempts(cart_id, created_at DESC);

ALTER TABLE public.cart_recovery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read recovery attempts"
  ON public.cart_recovery_attempts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins insert recovery attempts"
  ON public.cart_recovery_attempts FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
