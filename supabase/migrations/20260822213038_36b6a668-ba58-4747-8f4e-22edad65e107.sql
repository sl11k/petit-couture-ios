DROP POLICY IF EXISTS "Admins read carts" ON public.abandoned_carts;
CREATE POLICY "Admins staff and managers read carts"
ON public.abandoned_carts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'manager')
);