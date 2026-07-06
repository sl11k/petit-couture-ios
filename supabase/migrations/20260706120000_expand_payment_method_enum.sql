-- Expand payment_method enum to support all payment methods used by the app.
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'tabby';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'tamara';
