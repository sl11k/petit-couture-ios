-- ============================================
-- Stripe Secret Upsert & Pricing NULL Fixes
-- ============================================
-- Run this in your Supabase SQL Editor
-- Replace 'YOUR_STRIPE_SECRET_KEY' with actual value from Secrets

-- 1. Upsert Stripe secret into integrations table
INSERT INTO public.integrations (
  category,
  provider,
  display_name,
  enabled,
  mode,
  api_secret,
  config,
  updated_at
) VALUES (
  'payment',
  'stripe',
  'Stripe Payment Gateway',
  true,
  'live',
  'YOUR_STRIPE_SECRET_KEY',  -- REPLACE THIS WITH ACTUAL SECRET FROM SUPABASE SECRETS
  '{"webhook_endpoint": "/api/public/stripe-webhook"}'::jsonb,
  now()
)
ON CONFLICT (category, provider)
DO UPDATE SET
  api_secret = EXCLUDED.api_secret,
  enabled = true,
  mode = 'live',
  config = EXCLUDED.config,
  updated_at = now();

-- 2. Fix NULL prices in products table
-- Set default price for products with NULL price
UPDATE public.products
SET price = 0
WHERE price IS NULL;

-- 3. Fix NULL compare_at_price in products table
-- Set compare_at_price to NULL (or copy from price if needed)
UPDATE public.products
SET compare_at_price = NULL
WHERE compare_at_price IS NULL;

-- 4. Fix NULL prices in product_variants table (if exists)
UPDATE public.product_variants
SET price_override = 0
WHERE price_override IS NULL;

-- 5. Verify the changes
SELECT 
  'Stripe Integration' as check_type,
  COUNT(*) as count
FROM public.integrations
WHERE category = 'payment' AND provider = 'stripe';

SELECT 
  'Products with NULL price' as check_type,
  COUNT(*) as count
FROM public.products
WHERE price IS NULL;

SELECT 
  'Product variants with NULL price' as check_type,
  COUNT(*) as count
FROM public.product_variants
WHERE price_override IS NULL;
