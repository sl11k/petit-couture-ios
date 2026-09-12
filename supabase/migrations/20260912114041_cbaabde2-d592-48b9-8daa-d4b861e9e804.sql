CREATE POLICY "Service role manages Meta CAPI event ledger"
ON public.meta_capi_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);