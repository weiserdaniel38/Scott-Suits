-- Lets the shop admin clear notifications (one, or all). Safe to re-run;
-- run after 16_admin_notifications.sql. Cleared ones stay in the table but
-- no longer show in My Account > Notifications.

alter table public.admin_notifications add column if not exists cleared_at timestamptz;

create or replace function public.admin_list_notifications(p_limit int default 100)
returns table (
  id bigint,
  order_id text,
  created_at timestamptz,
  read_at timestamptz,
  customer_name text,
  suits int,
  total numeric,
  payment_status text,
  admin_no_payment boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see notifications';
  end if;
  return query
    select n.id, n.order_id, n.created_at, n.read_at,
           max(o.customer_name), count(o.id)::int, coalesce(sum(o.item_price_usd), 0),
           max(o.payment_status), bool_or(coalesce(o.admin_no_payment, false))
      from public.admin_notifications n
      join public.orders o on o.order_id = n.order_id
     where n.cleared_at is null
     group by n.id
     order by n.created_at desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- Clears one notification (p_id) or, with no id, all of them. Cleared ones
-- also count as read.
create or replace function public.admin_clear_notifications(p_id bigint default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can do this';
  end if;
  update public.admin_notifications
     set cleared_at = now(), read_at = coalesce(read_at, now())
   where cleared_at is null and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_clear_notifications(bigint) from public, anon;
grant execute on function public.admin_clear_notifications(bigint) to authenticated;
