-- Shipping updates (safe to re-run).
--
-- Lets the shop admin set each order's shipping progress (being made,
-- shipped, out for delivery, delivered) and tracking number from My Account
-- on scottssuits.com. Saving can also email and text the customer, through
-- the send-shipping-update edge function.
--
-- Test mode (the default): every email and text goes to the admin instead
-- of the customer, so nothing reaches a real client until the admin turns
-- "Send to customers" on in My Account.
--
-- Customers can see their own order's shipping status and tracking link
-- under Past Orders (they already can read their own orders).

alter table public.orders
  add column if not exists shipping_status text,
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text,
  add column if not exists shipping_updated_at timestamptz;

-- Customers can't pre-fill the shop-only fields when placing an order.
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
  end if;
  return new;
end;
$$;

-- One row of settings. live = false means test mode.
create table if not exists public.shipping_notify_settings (
  id int primary key default 1 check (id = 1),
  live boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.shipping_notify_settings (id) values (1) on conflict (id) do nothing;
-- No policies on purpose: only the functions below and the edge function read it.
alter table public.shipping_notify_settings enable row level security;

-- Every email/text attempt, for checking what went out.
create table if not exists public.shipping_notifications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  order_id text,
  shipping_status text,
  channel text,        -- 'email' or 'sms'
  recipient text,
  test_mode boolean,
  ok boolean,
  detail text
);
alter table public.shipping_notifications enable row level security;
create index if not exists shipping_notifications_order on public.shipping_notifications (order_id, created_at);

-- All orders, one row per order, for the admin's Orders list.
drop function if exists public.admin_list_orders(int);
create or replace function public.admin_list_orders(p_limit int default 200)
returns table (
  order_id text,
  created_at timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  suits int,
  total numeric,
  admin_no_payment boolean,
  shipping_status text,
  tracking_carrier text,
  tracking_number text,
  shipping_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see all orders';
  end if;
  return query
    select o.order_id,
           min(o.created_at),
           max(o.customer_name),
           max(o.customer_email),
           max(o.customer_phone),
           count(*)::int,
           coalesce(sum(o.item_price_usd), 0),
           bool_or(coalesce(o.admin_no_payment, false)),
           max(o.shipping_status),
           max(o.tracking_carrier),
           max(o.tracking_number),
           max(o.shipping_updated_at)
      from public.orders o
     where o.order_id is not null
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;
revoke all on function public.admin_list_orders(int) from public, anon;
grant execute on function public.admin_list_orders(int) to authenticated;

-- Saves an order's shipping status and tracking (all of its suits at once).
create or replace function public.admin_update_shipping(
  p_order_id text,
  p_status text,
  p_carrier text default null,
  p_tracking text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can update shipping';
  end if;
  if p_status is not null and p_status not in ('in_production', 'shipped', 'out_for_delivery', 'delivered') then
    raise exception 'Unknown shipping status %', p_status;
  end if;
  update public.orders
     set shipping_status = p_status,
         tracking_carrier = nullif(btrim(coalesce(p_carrier, '')), ''),
         tracking_number = nullif(btrim(coalesce(p_tracking, '')), ''),
         shipping_updated_at = now()
   where order_id = p_order_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_update_shipping(text, text, text, text) from public, anon;
grant execute on function public.admin_update_shipping(text, text, text, text) to authenticated;

-- Test mode on/off. Returns the new value (or the current one when p_live is null).
create or replace function public.admin_shipping_live(p_live boolean default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v boolean;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change this';
  end if;
  if p_live is not null then
    update public.shipping_notify_settings set live = p_live, updated_at = now() where id = 1;
  end if;
  select live into v from public.shipping_notify_settings where id = 1;
  return coalesce(v, false);
end;
$$;
revoke all on function public.admin_shipping_live(boolean) from public, anon;
grant execute on function public.admin_shipping_live(boolean) to authenticated;

notify pgrst, 'reload schema';
