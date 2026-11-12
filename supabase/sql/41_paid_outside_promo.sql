-- Promo codes for customers who pay Daniel in person (cash or Zelle)
-- (safe to re-run).
--
-- A code with paid_outside = true doesn't take money off: the order skips
-- Stripe and the stripe-checkout function marks it paid right away, with
-- orders.paid_outside = true and amount_paid_usd = the suits +
-- Alteration Protection (no shipping, no tax). Such an order counts as paid,
-- so it can go to the factory. Daniel types the code in on the customer's
-- order page once he has the money. Only the edge function sets these
-- fields; an order saved from the website never can.

alter table public.promo_codes
  add column if not exists paid_outside boolean not null default false;

alter table public.orders
  add column if not exists paid_outside boolean;

create or replace function public.orders_reset_promo()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.promo_discount_usd := null;
    new.paid_outside := null;
    new.promo_code := nullif(upper(btrim(coalesce(new.promo_code, ''))), '');
  end if;
  return new;
end;
$$;

-- Orders paid in person (cash/Zelle), for the admin's Orders list.
create or replace function public.admin_order_paid_outside(p_limit int default 1000)
returns table (order_id text)
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
    select o.order_id
      from public.orders o
     where o.order_id is not null and o.paid_outside is true
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_paid_outside(int) from public, anon;
grant execute on function public.admin_order_paid_outside(int) to authenticated;

-- The code itself (Daniel 2026-11-12): any account, as many times as needed.
insert into public.promo_codes (code, paid_outside, once_per_customer, note)
select 'CASHZELLE-89RP', true, false, 'Paid in person (cash or Zelle): order skips card payment and counts as paid'
 where not exists (select 1 from public.promo_codes where upper(code) = 'CASHZELLE-89RP');

notify pgrst, 'reload schema';

-- Daniel 2026-11-12: one use per account (by account, or by email for a
-- guest checkout). stripe-checkout counts paid orders with paid_outside.
update public.promo_codes set once_per_customer = true where upper(code) = 'CASHZELLE-89RP';
