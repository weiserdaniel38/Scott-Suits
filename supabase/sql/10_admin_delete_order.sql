-- Admin: delete an order (safe to re-run).
--
-- Lets the shop admin delete an order, with all of its suits, from the
-- Orders list in My Account on scottssuits.com. The site asks the admin to
-- confirm first. Only an admin can call this; everyone else gets an error.
-- The order's shipping update log goes with it.

create or replace function public.admin_delete_order(p_order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can delete orders';
  end if;
  if p_order_id is null or btrim(p_order_id) = '' then
    raise exception 'No order given';
  end if;
  delete from public.shipping_notifications where order_id = p_order_id;
  delete from public.orders where order_id = p_order_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_delete_order(text) from public, anon;
grant execute on function public.admin_delete_order(text) to authenticated;
