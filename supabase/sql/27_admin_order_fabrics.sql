-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- The fabric each suit was ordered in, for the admin's All Orders list
-- (merged with admin_list_orders on the site). Admin only. Safe to re-run.

create or replace function public.admin_order_fabrics(p_limit int default 1000)
returns table (
  order_id text,
  suit_number int,
  suit_type text,
  fabric text,
  pants_fabric text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see order fabrics';
  end if;
  return query
    select o.order_id, o.suit_number::int, o.suit_type::text, o.fabric::text, o.pants_fabric::text
      from public.orders o
     where o.order_id in (
       select x.order_id from public.orders x
        where x.order_id is not null
        group by x.order_id
        order by min(x.created_at) desc
        limit greatest(1, least(coalesce(p_limit, 1000), 5000)))
     order by o.order_id, o.suit_number;
end;
$$;
revoke all on function public.admin_order_fabrics(int) from public, anon;
grant execute on function public.admin_order_fabrics(int) to authenticated;

notify pgrst, 'reload schema';
