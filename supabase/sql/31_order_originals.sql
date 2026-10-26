-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Keeps a copy of every suit exactly as the customer placed it, so after an
-- admin edit ("Edit order" / "Edit suit") the shop can always look back at
-- the customer's own choices ("Customer's original" on each suit card in
-- All Orders). The copy is written when the order row is inserted and can't
-- be changed afterwards. Safe to re-run.

alter table public.orders add column if not exists original jsonb;

create or replace function public.orders_keep_original()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.original := to_jsonb(new) - 'original';
  elsif old.original is not null then
    new.original := old.original;
  end if;
  return new;
end;
$$;

-- "zz_" so it runs after the other before-insert triggers (they run in name
-- order) and copies the row as it is finally saved.
drop trigger if exists zz_orders_keep_original on public.orders;
create trigger zz_orders_keep_original
  before insert or update on public.orders
  for each row execute function public.orders_keep_original();

-- Orders placed before this existed: their copy is taken now, so it may
-- already include an edit made before today. Marked with "_backfilled".
update public.orders o
   set original = (to_jsonb(o) - 'original') || jsonb_build_object('_backfilled', now())
 where o.original is null;

-- Each suit's original copy for one order (admin only).
create or replace function public.admin_order_originals(p_order_id text)
returns table (suit_number int, original jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see order originals';
  end if;
  return query
    select o.suit_number::int, o.original
      from public.orders o
     where o.order_id = p_order_id
     order by o.suit_number;
end;
$$;
revoke all on function public.admin_order_originals(text) from public, anon;
grant execute on function public.admin_order_originals(text) to authenticated;

notify pgrst, 'reload schema';
