-- Hourly factory status check with automatic customer updates. Safe to
-- re-run; run after 15_factory_status_daily.sql and after kute-factory and
-- send-shipping-update are deployed with the automatic emails.
--
-- Every hour pg_cron asks kute-factory to refresh the factory status of
-- every suit still at the factory. When the factory's status moves an order
-- to its next step (sent to the factory, fabric cut, sewn, finishing, on its
-- way from the factory), the order's step is saved and the customer gets the
-- same email (and text, once Twilio is set up) as the admin's Save with
-- "Send update" ticked (Daniel, 2026-10-27). Test mode
-- (shipping_notify_settings.live = false) sends them to the admin instead.
--
-- Uses the same job token as the old daily job, which this replaces.

select cron.unschedule('kute-factory-status-daily')
where exists (select 1 from cron.job where jobname = 'kute-factory-status-daily');

select cron.schedule(
  'kute-factory-status-hourly',
  '7 * * * *',
  $job$
  select net.http_post(
    url := 'https://nvlhngzycldysosvhglx.supabase.co/functions/v1/kute-factory',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-token', (select token from public.job_tokens where name = 'kute-factory-status')
    ),
    body := '{"action":"factory_status_all"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
