-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- The finished suit picture of each suit, for the admin's All Orders list
-- (shown beside the fabric from admin_order_fabrics). Admin only. Safe to
-- re-run.

create or replace function public.admin_order_pictures(p_limit int default 1000)
returns table (
  order_id text,
  suit_number int,
  image_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see order pictures';
  end if;
  return query
    select o.order_id, o.suit_number::int, o.image_url::text
      from public.orders o
     where o.image_url is not null
       and o.order_id in (
       select x.order_id from public.orders x
        where x.order_id is not null
        group by x.order_id
        order by min(x.created_at) desc
        limit greatest(1, least(coalesce(p_limit, 1000), 5000)));
end;
$$;
revoke all on function public.admin_order_pictures(int) from public, anon;
grant execute on function public.admin_order_pictures(int) to authenticated;

notify pgrst, 'reload schema';
