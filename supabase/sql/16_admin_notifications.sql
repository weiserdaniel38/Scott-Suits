-- Admin notifications: one per order placed, shown in My Account >
-- Notifications for the shop admin. Safe to re-run.
--
-- A trigger adds a notification when an order's first suit is saved. The
-- admin's list shows who ordered, how many suits, the total and whether it
-- is paid (read live from the order), newest first, with unread ones marked
-- until the admin opens the list.

create table if not exists public.admin_notifications (
  id bigint generated always as identity primary key,
  kind text not null default 'order',
  order_id text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists admin_notifications_kind_order on public.admin_notifications (kind, order_id);
alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from public, anon, authenticated;

create or replace function public.orders_notify_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications (kind, order_id)
  values ('order', new.order_id)
  on conflict (kind, order_id) do nothing;
  return new;
end;
$$;
revoke all on function public.orders_notify_admin() from public, anon, authenticated;

create or replace trigger orders_notify_admin
  after insert on public.orders
  for each row
  when (new.order_id is not null)
  execute function public.orders_notify_admin();

-- Orders placed before this existed count as already read.
insert into public.admin_notifications (kind, order_id, created_at, read_at)
select 'order', o.order_id, min(o.created_at), now()
  from public.orders o
 where o.order_id is not null
 group by o.order_id
on conflict (kind, order_id) do nothing;

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
     group by n.id
     order by n.created_at desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;
revoke all on function public.admin_list_notifications(int) from public, anon;
grant execute on function public.admin_list_notifications(int) to authenticated;

create or replace function public.admin_mark_notifications_read()
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
  update public.admin_notifications set read_at = now() where read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_mark_notifications_read() from public, anon;
grant execute on function public.admin_mark_notifications_read() to authenticated;
