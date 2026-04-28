-- Return requests
CREATE TABLE IF NOT EXISTS public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL DEFAULT ('RT-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*10000))::text, 4, '0')),
  order_id uuid NOT NULL,
  order_number text,
  user_id uuid,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  reason text NOT NULL,
  reason_details text,
  refund_method text NOT NULL DEFAULT 'original',
  status text NOT NULL DEFAULT 'new',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_notes text,
  internal_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  reviewed_by_email text,
  reviewed_at timestamptz,
  decision_reason text,
  return_shipping_carrier text,
  return_tracking_number text,
  refund_amount numeric DEFAULT 0,
  shipping_fee_deducted numeric DEFAULT 0,
  exchange_order_id uuid,
  refunded_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_return_requests_order ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user ON public.return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own returns" ON public.return_requests;
CREATE POLICY "Users view own returns" ON public.return_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role));

DROP POLICY IF EXISTS "Users create own returns" ON public.return_requests;
CREATE POLICY "Users create own returns" ON public.return_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff manage returns" ON public.return_requests;
CREATE POLICY "Staff manage returns" ON public.return_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role));

DROP POLICY IF EXISTS "Admins delete returns" ON public.return_requests;
CREATE POLICY "Admins delete returns" ON public.return_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

-- Return items
CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id uuid NOT NULL,
  order_item_id uuid,
  product_id uuid,
  product_name text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  reason text,
  inspection_status text DEFAULT 'pending',
  inspection_notes text,
  restock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_return_items_req ON public.return_items(return_request_id);

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View items via parent" ON public.return_items;
CREATE POLICY "View items via parent" ON public.return_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.return_requests r WHERE r.id = return_items.return_request_id 
    AND (r.user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role))));

DROP POLICY IF EXISTS "Insert items via parent" ON public.return_items;
CREATE POLICY "Insert items via parent" ON public.return_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.return_requests r WHERE r.id = return_items.return_request_id
    AND (r.user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role))));

DROP POLICY IF EXISTS "Staff update items" ON public.return_items;
CREATE POLICY "Staff update items" ON public.return_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- Settings (single row)
CREATE TABLE IF NOT EXISTS public.return_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_window_days integer NOT NULL DEFAULT 14,
  deduct_shipping_fee boolean NOT NULL DEFAULT false,
  shipping_fee_amount numeric NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL DEFAULT '["منتج تالف","منتج مختلف عن الوصف","مقاس غير مناسب","لم يعجبني","سبب آخر"]'::jsonb,
  refund_methods jsonb NOT NULL DEFAULT '["original","store_credit","bank_transfer"]'::jsonb,
  policy_text_ar text DEFAULT 'يحق لك إرجاع المنتج خلال 14 يوماً من الاستلام بشرط أن يكون بحالته الأصلية وغير مستخدم.',
  policy_text_en text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.return_settings (id) SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM public.return_settings);

ALTER TABLE public.return_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read settings" ON public.return_settings;
CREATE POLICY "Public read settings" ON public.return_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins update settings" ON public.return_settings;
CREATE POLICY "Admins update settings" ON public.return_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Non-returnable products
CREATE TABLE IF NOT EXISTS public.non_returnable_products (
  product_id uuid PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.non_returnable_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read nonret" ON public.non_returnable_products;
CREATE POLICY "Public read nonret" ON public.non_returnable_products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage nonret" ON public.non_returnable_products;
CREATE POLICY "Admins manage nonret" ON public.non_returnable_products FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Trigger: bump updated_at
DROP TRIGGER IF EXISTS trg_return_requests_updated ON public.return_requests;
CREATE TRIGGER trg_return_requests_updated BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for return photos
INSERT INTO storage.buckets (id, name, public) VALUES ('return-photos','return-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read return photos" ON storage.objects;
CREATE POLICY "Public read return photos" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'return-photos');

DROP POLICY IF EXISTS "Auth upload return photos" ON storage.objects;
CREATE POLICY "Auth upload return photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'return-photos');

DROP POLICY IF EXISTS "Auth update own return photos" ON storage.objects;
CREATE POLICY "Auth update own return photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'return-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Staff delete return photos" ON storage.objects;
CREATE POLICY "Staff delete return photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'return-photos' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR auth.uid()::text = (storage.foldername(name))[1]));