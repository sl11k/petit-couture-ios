-- Per-size SKU on order line items.
-- Products can carry a distinct SKU per size/age; we snapshot the selected
-- size's SKU onto the order item so fulfilment, invoices and exports show the
-- exact code that was bought (independent of the variant/inventory tables).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sku text;

CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items(sku);
