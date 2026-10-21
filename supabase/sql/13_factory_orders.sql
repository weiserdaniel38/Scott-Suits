-- Sending orders to the factory (Kute Tailor Open API). Safe to re-run;
-- run after 12_stripe_payments.sql.
--
-- The admin presses "Send to factory" on a suit in My Account > Orders. The
-- kute-factory edge function turns the saved choices into the factory's
-- codes and saves the suit as a DRAFT order on the factory site (it is
-- never submitted from here); the admin checks it there and submits it.
-- The factory's order number, any error, and its production status are
-- kept on the suit's row.

alter table public.orders
  -- Choices the site already offered but didn't save on their own.
  add column if not exists felt_color text,
  add column if not exists jacket_monogram_text text,
  add column if not exists pants_monogram_text text,
  -- Factory link (shop only).
  add column if not exists factory_order_no text,
  add column if not exists factory_status text,
  add column if not exists factory_error text,
  add column if not exists factory_sent_at timestamptz,
  add column if not exists factory_delivery_date text,
  add column if not exists factory_waybill text;

-- Shop-only fields are reset on any order saved from the website.
create or replace function public.orders_reset_shop_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.status := 'received';
    new.image_status := null;
    new.image_url := null;
    new.image_prompt := null;
    new.image_error := null;
    new.image_updated_at := null;
    new.shipping_status := null;
    new.tracking_carrier := null;
    new.tracking_number := null;
    new.shipping_updated_at := null;
    if new.payment_status is distinct from 'awaiting_payment' or coalesce(new.admin_no_payment, false) then
      new.payment_status := null;
    end if;
    new.stripe_session_id := null;
    new.amount_paid_usd := null;
    new.paid_at := null;
    new.factory_order_no := null;
    new.factory_status := null;
    new.factory_error := null;
    new.factory_sent_at := null;
    new.factory_delivery_date := null;
    new.factory_waybill := null;
  end if;
  return new;
end;
$$;

-- The suits of one order with their factory fields, for the admin's
-- "Send to factory" panel.
create or replace function public.admin_order_suits(p_order_id text)
returns table (
  id uuid,
  suit_number int,
  suit_type text,
  factory_order_no text,
  factory_status text,
  factory_error text,
  factory_sent_at timestamptz,
  factory_delivery_date text,
  factory_waybill text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see factory details';
  end if;
  return query
    select o.id, o.suit_number, o.suit_type, o.factory_order_no, o.factory_status,
           o.factory_error, o.factory_sent_at, o.factory_delivery_date, o.factory_waybill
      from public.orders o
     where o.order_id = p_order_id
     order by o.suit_number;
end;
$$;
revoke all on function public.admin_order_suits(text) from public, anon;
grant execute on function public.admin_order_suits(text) to authenticated;

-- Height (inches) and weight (pounds), asked with the measurements; the
-- factory needs both.
alter table public.orders
  add column if not exists height numeric,
  add column if not exists weight numeric;
