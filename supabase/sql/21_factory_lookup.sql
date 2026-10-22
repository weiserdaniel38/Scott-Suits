-- Read-only factory lookups from the database. Safe to re-run; run after
-- 15_factory_status_daily.sql and after kute-factory is deployed with the
-- x-lookup-token check.
--
-- public.kute_lookup() asks kute-factory for one read-only action and
-- returns the request id; public.kute_lookup_result() returns the
-- factory's answer a second or two later. Only the database owner (the
-- Supabase dashboard / connector) can run them, not site visitors.
--
--   select public.kute_lookup('{"action":"status","orderNo":"DWNYP2610003"}');
--   select public.kute_lookup('{"action":"stock","code":"DZZ0110"}');
--   select public.kute_lookup('{"action":"archive","name":"crafts","params":{"categoryCode":"MXF"}}');
--   select * from public.kute_lookup_result(<id>);
--
-- The token is made here, inside the database, never shown to anyone, and
-- kute-factory lets it run only status, stock, fabric, archive and
-- factory_preview: nothing that saves, submits or cancels an order.

insert into public.job_tokens (name, token)
values ('kute-factory-lookup', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function public.kute_lookup(request jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(request->>'action', '') not in ('status', 'stock', 'fabric', 'archive', 'factory_preview') then
    raise exception 'kute_lookup only runs status, stock, fabric, archive or factory_preview';
  end if;
  return net.http_post(
    url := 'https://nvlhngzycldysosvhglx.supabase.co/functions/v1/kute-factory',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-lookup-token', (select token from public.job_tokens where name = 'kute-factory-lookup')
    ),
    body := request,
    timeout_milliseconds := 60000
  );
end;
$$;

create or replace function public.kute_lookup_result(request_id bigint)
returns table (status_code int, answer jsonb, error text)
language sql
security definer
set search_path = public, extensions
as $$
  select r.status_code,
         case when r.content ~ '^\s*[\[{]' then r.content::jsonb else to_jsonb(r.content) end,
         r.error_msg
  from net._http_response r
  where r.id = request_id;
$$;

revoke all on function public.kute_lookup(jsonb) from public, anon, authenticated;
revoke all on function public.kute_lookup_result(bigint) from public, anon, authenticated;
