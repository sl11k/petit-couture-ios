SELECT cron.schedule(
  'reconcile-deferred-payments',
  '*/10 * * * *',
  $$SELECT net.http_post(
      url := 'https://lppme.com/api/public/cron/reconcile-deferred-payments',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
  );$$
);