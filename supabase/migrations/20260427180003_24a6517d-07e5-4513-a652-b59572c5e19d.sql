-- ─── Roles ────────────────────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── Profiles ────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ─── Catalog ─────────────────────────────────────────────────────────────
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  brand TEXT,
  description_en TEXT,
  description_ar TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  compare_at_price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'SAR',
  image_url TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(is_active);
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active products" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ─── Orders ──────────────────────────────────────────────────────────────
CREATE TYPE public.order_status AS ENUM ('pending','paid','processing','shipped','delivered','cancelled','refunded');
CREATE TYPE public.payment_method AS ENUM ('cod','card','apple_pay','bank_transfer');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('MN-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*10000))::text,4,'0')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method NOT NULL DEFAULT 'cod',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_lat NUMERIC(10,7),
  shipping_lng NUMERIC(10,7),
  notes TEXT,
  tracking_number TEXT,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Anyone create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  image_url TEXT,
  size TEXT,
  color TEXT,
  qty INT NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View order items via order" ON public.order_items FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))));
CREATE POLICY "Insert order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins update items" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins delete items" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── Analytics ───────────────────────────────────────────────────────────
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_events_created ON public.analytics_events(created_at DESC);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone insert events" ON public.analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read events" ON public.analytics_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Abandoned carts: most recent state per session
CREATE TABLE public.abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  reached_checkout BOOLEAN NOT NULL DEFAULT false,
  converted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_carts_updated ON public.abandoned_carts(updated_at DESC);
CREATE TRIGGER carts_touch BEFORE UPDATE ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone upsert own cart" ON public.abandoned_carts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone update own cart by session" ON public.abandoned_carts FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Admins read carts" ON public.abandoned_carts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ─── Site settings (for changing UI from admin) ──────────────────────────
CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'Maisonnet',
  hero_title_en TEXT DEFAULT 'New Season',
  hero_title_ar TEXT DEFAULT 'موسم جديد',
  hero_subtitle_en TEXT DEFAULT 'Discover the latest collection',
  hero_subtitle_ar TEXT DEFAULT 'اكتشف أحدث المجموعات',
  hero_image_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  whatsapp_number TEXT DEFAULT '',
  support_email TEXT DEFAULT '',
  free_shipping_threshold NUMERIC(12,2) DEFAULT 500,
  shipping_fee NUMERIC(12,2) DEFAULT 25,
  tax_rate NUMERIC(5,4) DEFAULT 0.15,
  announcement_bar TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.site_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── Seed minimal demo data ──────────────────────────────────────────────
INSERT INTO public.categories (slug, name_en, name_ar, display_order) VALUES
  ('women','Women','نسائي',1),
  ('men','Men','رجالي',2),
  ('bags','Bags','حقائب',3),
  ('shoes','Shoes','أحذية',4)
ON CONFLICT DO NOTHING;