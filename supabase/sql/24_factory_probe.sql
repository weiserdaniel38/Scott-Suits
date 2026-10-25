-- Lets public.kute_lookup() also run kute-factory's factory_probe action:
-- a TEST draft at the factory (never submitted) with some choices changed,
-- to find which option combinations the factory refuses (Daniel, 2026-10-25).
-- Safe to re-run.

create or replace function public.kute_lookup(request jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(request->>'action', '') not in ('status', 'stock', 'fabric', 'archive', 'factory_preview', 'factory_probe') then
    raise exception 'kute_lookup only runs status, stock, fabric, archive, factory_preview or factory_probe';
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

revoke all on function public.kute_lookup(jsonb) from public, anon, authenticated;
