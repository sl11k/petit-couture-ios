CREATE OR REPLACE FUNCTION public.get_user_emails(_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;