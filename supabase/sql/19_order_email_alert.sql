-- New order email for the shop admin (safe to re-run). Run after
-- 16_admin_notifications.sql, once the send-order-alert function is
-- deployed.
--
-- One email per order, sent the moment:
--   - Stripe confirms the payment (payment_status turns 'paid'), or
--   - an admin "Place order without payment" order is saved.
-- Orders still waiting for payment, or cancelled on Stripe's page, never
-- send one. admin_notifications.emailed_at records the send, so an order
-- with several suits (several rows) still sends only once.
--
-- Replace PASTE_WEBHOOK_SECRET_HERE with the exact WEBHOOK_SECRET value
-- (the same one 5_welcome_email_trigger.sql uses).
--
-- The call happens in the background (pg_net) after the order is saved, so
-- a problem sending the email never stops an order.

create extension if not exists pg_net;

alter table public.admin_notifications add column if not exists emailed_at timestamptz;

-- Orders from before this existed never send an email.
update public.admin_notifications set emailed_at = coalesce(emailed_at, created_at) where emailed_at is null;

create or replace function public.orders_email_admin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.admin_notifications (kind, order_id)
  values ('order', new.order_id)
  on conflict (kind, order_id) do nothing;
  update public.admin_notifications
     set emailed_at = now()
   where kind = 'order' and order_id = new.order_id and emailed_at is null;
  if found then
    perform net.http_post(
      url := 'https://nvlhngzycldysosvhglx.supabase.co/functions/v1/send-order-alert',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-webhook-secret', 'PASTE_WEBHOOK_SECRET_HERE'
      ),
      body := jsonb_build_object('order_id', new.order_id)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.orders_email_admin() from public, anon, authenticated;

create or replace trigger orders_email_admin_insert
  after insert on public.orders
  for each row
  when (new.order_id is not null and (coalesce(new.admin_no_payment, false) or new.payment_status = 'paid'))
  execute function public.orders_email_admin();

create or replace trigger orders_email_admin_paid
  after update of payment_status on public.orders
  for each row
  when (new.order_id is not null and new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function public.orders_email_admin();
