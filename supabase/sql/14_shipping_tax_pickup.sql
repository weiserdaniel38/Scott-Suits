-- Shipping, sales tax and in-store pickup at checkout (safe to re-run).
--
-- fulfillment: 'ship' (shipped to the customer, flat shipping + sales tax
-- added at Stripe checkout) or 'pickup' (picked up in store: no shipping,
-- no tax). The customer picks it on the order page.
-- shipping_usd / tax_usd: what Stripe actually charged for the whole order,
-- written only by the stripe-checkout function once the payment is
-- confirmed. The website can't set them (trigger below).

alter table public.orders
  add column if not exists fulfillment text,
  add column if not exists shipping_usd numeric,
  add column if not exists tax_usd numeric;

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
    if new.fulfillment is distinct from 'pickup' then
      new.fulfillment := 'ship';
    end if;
    new.shipping_usd := null;
    new.tax_usd := null;
  end if;
  return new;
end;
$$;

-- Pickup / shipping / tax per order, for the admin's Orders list.
create or replace function public.admin_order_extras(p_limit int default 1000)
returns table (
  order_id text,
  fulfillment text,
  shipping_usd numeric,
  tax_usd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see this';
  end if;
  return query
    select o.order_id, max(o.fulfillment), max(o.shipping_usd), max(o.tax_usd)
      from public.orders o
     where o.order_id is not null
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_extras(int) from public, anon;
grant execute on function public.admin_order_extras(int) to authenticated;

notify pgrst, 'reload schema';
