
-- 1) Make handle_new_user idempotent and ensure default 'customer' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Backfill existing users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'customer'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.profiles (user_id, email, full_name)
SELECT u.id, u.email, u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- 4) RPC: list all users with roles (admins only)
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz, roles text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id,
         u.email::text,
         u.created_at,
         COALESCE(ARRAY_AGG(r.role::text) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::text[]) AS roles
  FROM auth.users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  GROUP BY u.id, u.email, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

-- 5) RPC: set roles for a user atomically (admins only)
CREATE OR REPLACE FUNCTION public.set_user_roles(_user_id uuid, _roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role::text <> ALL(COALESCE(_roles, ARRAY[]::text[]));

  IF _roles IS NOT NULL THEN
    FOREACH r IN ARRAY _roles LOOP
      INSERT INTO public.user_roles (user_id, role)
      VALUES (_user_id, r::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_with_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_roles(uuid, text[]) TO authenticated;
