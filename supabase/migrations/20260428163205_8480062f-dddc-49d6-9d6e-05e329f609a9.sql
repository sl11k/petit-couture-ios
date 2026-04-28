
-- Extend order_status enum with the missing states
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready_to_ship';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partially_refunded';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'fraud';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_customer';

-- Add new columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'not_created',
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS internal_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invoice_number text;

-- Indexes for new filterable columns
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON public.orders(shipping_status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON public.orders(shipping_carrier);
