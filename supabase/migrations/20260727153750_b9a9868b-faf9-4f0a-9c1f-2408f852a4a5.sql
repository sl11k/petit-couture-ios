-- Audiences (generated customer lists)
CREATE TABLE public.campaign_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_count integer NOT NULL DEFAULT 0,
  provider text,
  provider_list_id text,
  synced_at timestamptz,
  last_generated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_audiences TO authenticated;
GRANT ALL ON public.campaign_audiences TO service_role;
ALTER TABLE public.campaign_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing team can view audiences" ON public.campaign_audiences FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Marketing team can insert audiences" ON public.campaign_audiences FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Marketing team can update audiences" ON public.campaign_audiences FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Admins can delete audiences" ON public.campaign_audiences FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));
CREATE TRIGGER campaign_audiences_updated_at BEFORE UPDATE ON public.campaign_audiences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Audience members (snapshot of consented customers)
CREATE TABLE public.campaign_audience_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id uuid NOT NULL REFERENCES public.campaign_audiences(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  full_name text,
  phone text,
  consent_source text,
  consent_at timestamptz,
  orders_count integer NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audience_id, email)
);
CREATE INDEX campaign_audience_members_audience_idx ON public.campaign_audience_members(audience_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_audience_members TO authenticated;
GRANT ALL ON public.campaign_audience_members TO service_role;
ALTER TABLE public.campaign_audience_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing team can view audience members" ON public.campaign_audience_members FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Marketing team can manage audience members" ON public.campaign_audience_members FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));

-- Campaign requests (approval workflow)
CREATE TABLE public.campaign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  objective text,
  channel text NOT NULL DEFAULT 'email',
  audience_id uuid REFERENCES public.campaign_audiences(id) ON DELETE SET NULL,
  coupon_code text,
  email_subject text,
  email_body text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  provider text,
  provider_campaign_id text,
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  rejection_reason text,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_requests TO authenticated;
GRANT ALL ON public.campaign_requests TO service_role;
ALTER TABLE public.campaign_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketing team can view campaign requests" ON public.campaign_requests FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Marketing team can insert campaign requests" ON public.campaign_requests FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Marketing team can update campaign requests" ON public.campaign_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'marketing_manager'));
CREATE POLICY "Admins can delete campaign requests" ON public.campaign_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin'));
CREATE TRIGGER campaign_requests_updated_at BEFORE UPDATE ON public.campaign_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();