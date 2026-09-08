select cron.unschedule('reconcile-stripe-orders') where exists (select 1 from cron.job where jobname='reconcile-stripe-orders');
select cron.schedule(
  'reconcile-stripe-orders',
  '*/10 * * * *',
  $$select net.http_post(
      url := 'https://lppme.com/api/public/cron/reconcile-stripe',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
  );$$
);