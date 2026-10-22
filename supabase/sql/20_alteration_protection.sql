-- Alteration Protection add-on (safe to re-run).
--
-- On the order page the customer must pick Yes or No for Alteration
-- Protection: $100 per suit/item, covering three free alterations of that
-- item. Saying No means alterations are at the customer's cost and the shop
-- takes no responsibility for problems from measurements the customer
-- entered wrong.
--
-- alteration_protection: true (bought), false (declined), null (orders from
-- before this existed). alteration_protection_usd: what it added for that
-- item. The stripe-checkout function charges it as its own line. Never sent
-- to the factory.

alter table public.orders
  add column if not exists alteration_protection boolean,
  add column if not exists alteration_protection_usd numeric;

-- Protection per order, for the admin's Orders list.
create or replace function public.admin_order_protection(p_limit int default 1000)
returns table (
  order_id text,
  protection_items int,
  protection_declined boolean,
  protection_usd numeric
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
    select o.order_id,
           count(*) filter (where o.alteration_protection)::int,
           bool_or(o.alteration_protection = false),
           coalesce(sum(o.alteration_protection_usd) filter (where o.alteration_protection), 0)
      from public.orders o
     where o.order_id is not null
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_protection(int) from public, anon;
grant execute on function public.admin_order_protection(int) to authenticated;

notify pgrst, 'reload schema';
