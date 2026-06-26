-- Site settings: billing/tax fields
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS company_legal_name text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS commercial_register text,
  ADD COLUMN IF NOT EXISTS store_address text,
  ADD COLUMN IF NOT EXISTS store_city text,
  ADD COLUMN IF NOT EXISTS store_country text DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS store_phone text DEFAULT '+96655 740 4827',
  ADD COLUMN IF NOT EXISTS invoice_logo_url text,
  ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS invoice_footer_note text,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_label text DEFAULT 'ضريبة القيمة المضافة',
  ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS currency_symbol text DEFAULT 'ر.س',
  ADD COLUMN IF NOT EXISTS issue_tax_invoice boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_issue_on_payment boolean NOT NULL DEFAULT true;

-- Counters per year
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_type text NOT NULL DEFAULT 'tax_invoice',
  status text NOT NULL DEFAULT 'issued',
  order_id uuid,
  order_number text,
  user_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  customer_tax_number text,
  store_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  shipping_fee numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_inclusive boolean NOT NULL DEFAULT true,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  pdf_url text,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid,
  related_invoice_id uuid,
  email_sent_at timestamptz,
  email_sent_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices(issued_at);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own invoices" ON public.invoices;
CREATE POLICY "Users view own invoices" ON public.invoices FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'viewer'::app_role));

DROP POLICY IF EXISTS "Staff insert invoices" ON public.invoices;
CREATE POLICY "Staff insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role));

DROP POLICY IF EXISTS "Staff update invoices" ON public.invoices;
CREATE POLICY "Staff update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role));

DROP POLICY IF EXISTS "Admins delete invoices" ON public.invoices;
CREATE POLICY "Admins delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read counters" ON public.invoice_counters;
CREATE POLICY "Staff read counters" ON public.invoice_counters FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- Atomic invoice number generator
CREATE OR REPLACE FUNCTION public.next_invoice_number(_prefix text DEFAULT 'INV')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr integer := EXTRACT(YEAR FROM now())::int;
  next_n integer;
BEGIN
  INSERT INTO public.invoice_counters(year, last_number) VALUES (yr, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO next_n;
  RETURN COALESCE(_prefix,'INV') || '-' || yr::text || '-' || lpad(next_n::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(text) TO authenticated;

-- Trigger: bump updated_at
DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
