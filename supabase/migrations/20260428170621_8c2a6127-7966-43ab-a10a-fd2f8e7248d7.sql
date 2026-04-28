
-- Payment transactions: every attempt is recorded
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  customer_email text,
  customer_name text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  gateway text NOT NULL,
  gateway_method text,
  gateway_transaction_id text,
  gateway_reference text,
  card_last4 text,
  card_brand text,
  status text NOT NULL DEFAULT 'pending',
  error_code text,
  error_message text,
  gateway_fee numeric DEFAULT 0,
  net_amount numeric,
  idempotency_key text UNIQUE,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_response jsonb,
  webhook_verified boolean NOT NULL DEFAULT false,
  authorized_at timestamp with time zone,
  captured_at timestamp with time zone,
  failed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_pt_order ON public.payment_transactions(order_id);
CREATE INDEX idx_pt_status ON public.payment_transactions(status);
CREATE INDEX idx_pt_gateway ON public.payment_transactions(gateway);
CREATE INDEX idx_pt_created ON public.payment_transactions(created_at DESC);
CREATE INDEX idx_pt_gtxn ON public.payment_transactions(gateway_transaction_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));

CREATE POLICY "Admins insert transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Admins update transactions" ON public.payment_transactions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Refunds
CREATE TABLE public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  reason text,
  is_partial boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  gateway_refund_id text,
  error_message text,
  approved_by uuid,
  approved_by_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE INDEX idx_refunds_order ON public.payment_refunds(order_id);
CREATE INDEX idx_refunds_txn ON public.payment_refunds(transaction_id);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read refunds" ON public.payment_refunds
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));

CREATE POLICY "Managers create refunds" ON public.payment_refunds
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE POLICY "Managers update refunds" ON public.payment_refunds
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Payment method configs
CREATE TABLE public.payment_method_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  display_name_ar text NOT NULL,
  display_name_en text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  gateway text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  min_amount numeric,
  max_amount numeric,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_method_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read enabled methods" ON public.payment_method_configs
  FOR SELECT TO anon, authenticated
  USING (is_enabled = true OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Admins manage methods" ON public.payment_method_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

-- Seed default payment methods
INSERT INTO public.payment_method_configs (method_key, display_name_ar, display_name_en, is_enabled, gateway, icon, display_order) VALUES
  ('cod', 'الدفع عند الاستلام', 'Cash on Delivery', true, 'manual', '💵', 1),
  ('bank_transfer', 'تحويل بنكي', 'Bank Transfer', true, 'manual', '🏦', 2),
  ('payment_link', 'رابط دفع يدوي', 'Manual Payment Link', true, 'manual', '🔗', 3),
  ('card', 'بطاقات ائتمانية', 'Credit/Debit Cards', false, null, '💳', 4),
  ('mada', 'مدى', 'Mada', false, null, '💳', 5),
  ('apple_pay', 'Apple Pay', 'Apple Pay', false, null, '', 6),
  ('stc_pay', 'STC Pay', 'STC Pay', false, null, '📱', 7),
  ('tabby', 'تابي - قسّمها على 4', 'Tabby - Split in 4', false, null, '🟢', 8),
  ('tamara', 'تمارا - اشتر الآن وادفع لاحقًا', 'Tamara - BNPL', false, null, '🟣', 9);

-- Webhook logs (for security audit)
CREATE TABLE public.payment_webhooks_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL,
  event_type text,
  signature text,
  signature_valid boolean NOT NULL DEFAULT false,
  ip_address text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  related_transaction_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_log_gateway ON public.payment_webhooks_log(gateway, created_at DESC);

ALTER TABLE public.payment_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read webhook logs" ON public.payment_webhooks_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Extend orders with capture/refund tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS captured_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_gateway text,
  ADD COLUMN IF NOT EXISTS last_transaction_id uuid;

-- Trigger to auto-update updated_at
CREATE TRIGGER touch_pt_updated BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_pmc_updated BEFORE UPDATE ON public.payment_method_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
