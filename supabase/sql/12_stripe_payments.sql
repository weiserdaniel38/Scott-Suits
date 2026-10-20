-- Stripe payments (safe to re-run).
--
-- With Stripe on (STRIPE_CHECKOUT_ENABLED in config.js), the order is saved
-- first with payment_status = 'awaiting_payment', then the customer pays on
-- Stripe's checkout page. The stripe-checkout edge function checks the
-- payment with Stripe itself and only then sets payment_status = 'paid'.
-- The website can never mark an order paid: the trigger below resets every
-- payment field on an order saved from the site.
--
-- Admin orders (admin_no_payment = true) never go to Stripe and never need
-- a paid status.

alter table public.orders
  add column if not exists payment_status text,
  add column if not exists stripe_session_id text,
  add column if not exists amount_paid_usd numeric,
  add column if not exists paid_at timestamptz;

create index if not exists orders_stripe_session on public.orders (stripe_session_id);

-- Shop-only fields are reset on any order saved from the website. A site
-- order may only start as 'awaiting_payment' (Stripe on) or with no payment
-- status at all (Stripe off).
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
  end if;
  return new;
end;
$$;

-- Payment status per order, for the admin's Orders list (merged with
-- admin_list_orders on the site).
create or replace function public.admin_order_payments(p_limit int default 1000)
returns table (
  order_id text,
  payment_status text,
  amount_paid_usd numeric,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see payments';
  end if;
  return query
    select o.order_id, max(o.payment_status), max(o.amount_paid_usd), max(o.paid_at)
      from public.orders o
     where o.order_id is not null
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_payments(int) from public, anon;
grant execute on function public.admin_order_payments(int) to authenticated;

notify pgrst, 'reload schema';
