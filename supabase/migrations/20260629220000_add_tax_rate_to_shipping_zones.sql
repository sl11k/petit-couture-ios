-- Add tax_rate column to shipping_zones table
ALTER TABLE public.shipping_zones ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;
