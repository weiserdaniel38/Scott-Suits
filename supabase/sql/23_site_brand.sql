-- Which storefront an order came from (safe to re-run). Run after
-- 19_order_email_alert.sql and 20_alteration_protection.sql.
--
-- 'scott' = Scott's Suits (scottssuits.com), 'sw' = S.W. Atelier, the
-- coworker copy of the site (brand.js). S.W. Atelier shows no prices and
-- takes no payment, so its orders are saved as requests (payment_status
-- stays empty). They still reach admin and the factory flow, and they send
-- the admin order email the moment they are placed, since they never turn
-- 'paid' (Daniel, 2026-10-25).

alter table public.orders add column if not exists brand text not null default 'scott';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_brand_known') then
    alter table public.orders add constraint orders_brand_known check (brand in ('scott', 'sw'));
  end if;
end;
$$;

-- Admin: the brand of each order (merged into the Orders list and the
-- notifications in main.js, like admin_order_protection).
create or replace function public.admin_order_brands(p_limit int default 1000)
returns table (
  order_id text,
  brand text
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
    select o.order_id, max(o.brand)
      from public.orders o
     where o.order_id is not null
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_brands(int) from public, anon;
grant execute on function public.admin_order_brands(int) to authenticated;

-- Order email for brands with no payment: on insert, not on 'paid'.
-- orders_email_admin() records the send in admin_notifications.emailed_at,
-- so an order with several suits still sends one email.
create or replace trigger orders_email_admin_request
  after insert on public.orders
  for each row
  when (new.order_id is not null and new.brand = 'sw' and not coalesce(new.admin_no_payment, false))
  execute function public.orders_email_admin();

notify pgrst, 'reload schema';
