-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Finished-suit picture feature, part 2 of 2 (safe to re-run).
-- Run it AFTER the generate-suit-image function is deployed and its
-- WEBHOOK_SECRET is saved under Edge Functions > Secrets.
--
-- When an order row's status changes to 'completed', this calls the
-- generate-suit-image function, which draws the suit and fills in
-- image_url about a minute later.
--
-- Replace PASTE_WEBHOOK_SECRET_HERE with the exact WEBHOOK_SECRET value.

create extension if not exists pg_net;

create or replace function public.request_suit_image()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://nvlhngzycldysosvhglx.supabase.co/functions/v1/generate-suit-image',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-webhook-secret', 'PASTE_WEBHOOK_SECRET_HERE'
    ),
    body := jsonb_build_object('record', jsonb_build_object('id', new.id))
  );
  return new;
end;
$$;

revoke all on function public.request_suit_image() from public, anon, authenticated;

drop trigger if exists orders_suit_image_on_complete on public.orders;
create trigger orders_suit_image_on_complete
  after update of status on public.orders
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.request_suit_image();

-- Alternative: draw the picture as soon as the customer places the order
-- (instead of when you mark it completed). Each picture costs a few cents
-- of OpenAI credit, and anyone can submit an order, so this is off by
-- default. To switch, run these two lines as well:
--
-- drop trigger if exists orders_suit_image_on_placed on public.orders;
-- create trigger orders_suit_image_on_placed after insert on public.orders
--   for each row when (new.visual_spec is not null) execute function public.request_suit_image();
