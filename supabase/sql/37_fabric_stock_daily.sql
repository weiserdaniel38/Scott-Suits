-- Daily fabric stock check (Daniel, 2026-11-01: "auto update the fabric list
-- every day to make sure everything is in stock"). Safe to re-run.
--
-- Every day pg_cron asks kute-factory (action fabric_stock_all) to look up the
-- factory's stock of every fabric on the site. It saves the result as
-- fabric-stock.json in the public suit-images storage bucket (no table, so
-- no schema change). The site (main.js loadFabricStock) hides any fabric with
-- less than FABRIC_MIN_STOCK_M metres unless it is the customer's current
-- pick. A failed lookup saves null, which the site ignores.

select cron.unschedule('fabric-stock-daily')
where exists (select 1 from cron.job where jobname = 'fabric-stock-daily');

-- 09:20 UTC = 5:20am New York.
select cron.schedule(
  'fabric-stock-daily',
  '20 9 * * *',
  $job$
  select net.http_post(
    url := 'https://nvlhngzycldysosvhglx.supabase.co/functions/v1/kute-factory',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-token', (select token from public.job_tokens where name = 'kute-factory-status')
    ),
    body := '{"action":"fabric_stock_all"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $job$
);
