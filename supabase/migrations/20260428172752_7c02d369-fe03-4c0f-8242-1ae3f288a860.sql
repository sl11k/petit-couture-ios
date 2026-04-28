
-- Tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT ('T-' || to_char(now(),'YYMMDD') || '-' || lpad(floor(random()*10000)::text, 4, '0')),
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('order_inquiry','payment_issue','shipping_issue','return','damaged_product','general','other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','waiting_customer','waiting_admin','resolved','closed')),
  customer_user_id uuid,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  related_order_id uuid,
  related_order_number text,
  assigned_to uuid,
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web','email','whatsapp','phone','admin')),
  last_reply_at timestamptz,
  last_reply_by text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX idx_tickets_user ON public.support_tickets(customer_user_id);
CREATE INDEX idx_tickets_email ON public.support_tickets(customer_email);

-- Ticket messages
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  body text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('customer','staff','system')),
  is_internal_note boolean NOT NULL DEFAULT false,
  author_id uuid,
  author_email text,
  author_name text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_msgs_ticket ON public.support_ticket_messages(ticket_id, created_at);

-- Canned replies
CREATE TABLE public.support_canned_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text,
  template_key text,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ticket ratings
CREATE TABLE public.support_ticket_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  customer_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FAQ
CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  question_ar text NOT NULL,
  answer_ar text NOT NULL,
  question_en text,
  answer_en text,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- General contact form submissions
CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_faq_updated BEFORE UPDATE ON public.faq_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger: bump ticket last_reply when a message is added
CREATE OR REPLACE FUNCTION public.bump_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_internal_note = false THEN
    UPDATE public.support_tickets
    SET last_reply_at = NEW.created_at,
        last_reply_by = NEW.direction,
        status = CASE 
          WHEN NEW.direction = 'customer' AND status IN ('waiting_customer','resolved') THEN 'waiting_admin'
          WHEN NEW.direction = 'staff' AND status IN ('new','waiting_admin') THEN 'waiting_customer'
          ELSE status
        END,
        updated_at = now()
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bump_ticket_msg AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_on_message();

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_canned_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "anyone_create_ticket" ON public.support_tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "user_read_own_ticket" ON public.support_tickets FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));
CREATE POLICY "staff_update_ticket" ON public.support_tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));
CREATE POLICY "admin_delete_ticket" ON public.support_tickets FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Ticket messages policies
CREATE POLICY "user_read_own_ticket_msg" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    (is_internal_note = false AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.customer_user_id = auth.uid()))
    OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer')
  );
CREATE POLICY "user_insert_own_ticket_msg" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    is_internal_note = false AND (
      EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.customer_user_id = auth.uid())
      OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff')
    )
  );
CREATE POLICY "anon_insert_initial_msg" ON public.support_ticket_messages FOR INSERT TO anon WITH CHECK (is_internal_note = false);
CREATE POLICY "staff_insert_internal" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));

-- Canned replies (staff)
CREATE POLICY "staff_read_canned" ON public.support_canned_replies FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));
CREATE POLICY "manager_write_canned" ON public.support_canned_replies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Ratings (customer can rate own ticket)
CREATE POLICY "user_rate_own_ticket" ON public.support_ticket_ratings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.customer_user_id = auth.uid()));
CREATE POLICY "anon_rate_via_token" ON public.support_ticket_ratings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "read_ratings" ON public.support_ticket_ratings FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff') OR has_role(auth.uid(),'viewer'));

-- FAQ (public read, admin manage)
CREATE POLICY "public_read_faq" ON public.faq_items FOR SELECT TO anon, authenticated USING (is_enabled = true OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "admin_manage_faq" ON public.faq_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Contact submissions
CREATE POLICY "anyone_submit_contact" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff_read_contact" ON public.contact_submissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));
CREATE POLICY "staff_update_contact" ON public.contact_submissions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff'));

-- Seed FAQ
INSERT INTO public.faq_items (category, question_ar, answer_ar, sort_order) VALUES
  ('orders', 'كيف أتابع طلبي؟', 'يمكنك تتبع طلبك من صفحة "تتبع الطلب" بإدخال رقم الطلب والبريد الإلكتروني.', 1),
  ('orders', 'كم يستغرق التوصيل؟', 'عادة من 2 إلى 5 أيام عمل داخل المملكة بحسب المدينة.', 2),
  ('payment', 'ما طرق الدفع المتاحة؟', 'نقبل البطاقات (Visa/Mada)، Apple Pay، STC Pay، التحويل البنكي، والدفع عند الاستلام.', 3),
  ('returns', 'كيف أرجع منتج؟', 'تواصل مع خدمة العملاء خلال 14 يوماً من الاستلام لطلب الإرجاع.', 4),
  ('shipping', 'هل تشحنون لجميع المدن؟', 'نشحن لجميع مدن المملكة العربية السعودية ودول الخليج.', 5),
  ('account', 'كيف أعدل عنواني؟', 'من صفحة حسابي > العناوين، يمكنك إضافة وتعديل العناوين بسهولة.', 6);

-- Seed canned replies
INSERT INTO public.support_canned_replies (title, body, category, sort_order) VALUES
  ('ترحيب', 'مرحباً بك، شكراً للتواصل مع خدمة عملاء Maisonnet. كيف يمكنني مساعدتك؟', 'general', 1),
  ('متابعة طلب', 'تم استلام استفسارك بخصوص الطلب {{order_number}}، نراجع التفاصيل ونعود إليك خلال ساعات قليلة.', 'order_inquiry', 2),
  ('استلام الدفع', 'تم استلام دفعتك بنجاح، سيتم تجهيز طلبك وشحنه قريباً.', 'payment_issue', 3),
  ('بانتظار التأكيد', 'بانتظار تأكيد الدفع من البنك، سنحدثك فور وصول التأكيد.', 'payment_issue', 4),
  ('شكر إغلاق', 'تم حل استفسارك. إذا احتجت أي مساعدة لاحقاً لا تتردد في التواصل معنا. شكراً لاختيارك Maisonnet.', 'general', 5),
  ('عذر تأخير', 'نعتذر عن أي تأخير. نعمل حالياً على حل المشكلة وسنحدثك قريباً جداً.', 'general', 6);
