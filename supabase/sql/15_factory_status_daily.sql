-- Daily factory status check. Safe to re-run; run after 13_factory_orders.sql
-- and after kute-factory is deployed with the factory_status_all action.
--
-- Every day at 14:00 UTC (10am Eastern) pg_cron asks kute-factory to refresh
-- the factory status of every suit still at the factory, the same as the
-- admin pressing "Factory status" on each one: production step, delivery
-- date and the factory's waybill. No email or text goes out.
--
-- The job signs in with a random token made here, inside the database; it
-- is never shown to anyone and only lets the job run that one action.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.job_tokens (
  name text primary key,
  token text not null,
  created_at timestamptz not null default now()
);
alter table public.job_tokens enable row level security;
revoke all on public.job_tokens from public, anon, authenticated;

insert into public.job_tokens (name, token)
values ('kute-factory-status', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

select cron.schedule(
  'kute-factory-status-daily',
  '0 14 * * *',
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
