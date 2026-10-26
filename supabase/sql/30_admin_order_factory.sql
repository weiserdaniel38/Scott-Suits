-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Each suit's factory order number and status for the admin's All Orders
-- list, so every suit card shows them without opening Send to factory
-- (the same fields admin_order_suits gives for one order). Admin only.
-- Safe to re-run.

create or replace function public.admin_order_factory(p_limit int default 1000)
returns table (
  order_id text,
  suit_number int,
  suit_type text,
  factory_order_no text,
  factory_status text,
  factory_error text,
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
    select o.order_id, o.suit_number::int, o.suit_type::text, o.factory_order_no::text, o.factory_status::text,
           o.factory_error::text, o.factory_delivery_date::text, o.factory_waybill::text
      from public.orders o
     where o.order_id in (
       select x.order_id from public.orders x
        where x.order_id is not null
        group by x.order_id
        order by min(x.created_at) desc
        limit greatest(1, least(coalesce(p_limit, 1000), 5000)));
end;
$$;
revoke all on function public.admin_order_factory(int) from public, anon;
grant execute on function public.admin_order_factory(int) to authenticated;

notify pgrst, 'reload schema';
