-- Admin: edit an order already placed (safe to re-run).
--
-- "Edit order" in My Account > All Orders loads an order's suits into the
-- designer, so every option rule applies exactly as for a customer. "Save
-- changes to order" then calls admin_update_order with one object per
-- suit: its row id plus the columns to change (options, measurements,
-- monogram text, contact and shipping details, the regenerated order text).
-- Payment, prices, brand, shipping progress and factory fields are never
-- changed here. A suit left out of the list is removed from the order.
-- Columns the database doesn't have yet are skipped, same as a new order.
-- Only an admin can call these; everyone else gets an error.

create or replace function public.admin_order_rows(p_order_id text)
returns setof public.orders
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can edit orders';
  end if;
  return query
    select * from public.orders o where o.order_id = p_order_id order by o.suit_number;
end;
$$;
revoke all on function public.admin_order_rows(text) from public, anon;
grant execute on function public.admin_order_rows(text) to authenticated;

create or replace function public.admin_update_order(p_order_id text, p_suits jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  locked text[] := array[
    'id', 'order_id', 'user_id', 'created_at', 'brand', 'item_price_usd',
    'admin_no_payment', 'payment_status', 'stripe_session_id', 'amount_paid_usd',
    'paid_at', 'shipping_usd', 'tax_usd', 'alteration_protection',
    'alteration_protection_usd', 'status', 'image_status', 'image_url',
    'image_prompt', 'image_error', 'image_updated_at', 'shipping_status',
    'tracking_carrier', 'tracking_number', 'shipping_updated_at',
    'factory_order_no', 'factory_status', 'factory_error', 'factory_sent_at',
    'factory_delivery_date', 'factory_waybill'];
  ids uuid[];
  suit jsonb;
  sets text;
  n int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can edit orders';
  end if;
  if p_order_id is null or jsonb_typeof(p_suits) <> 'array' or jsonb_array_length(p_suits) = 0 then
    raise exception 'An order needs at least one suit';
  end if;
  select array_agg((s->>'id')::uuid) into ids from jsonb_array_elements(p_suits) s;
  if (select count(*) from public.orders where order_id = p_order_id and id = any(ids)) <> jsonb_array_length(p_suits)
     or array_position(ids, null) is not null then
    raise exception 'Those suits aren''t all part of this order';
  end if;

  delete from public.orders where order_id = p_order_id and id <> all(ids);

  for suit in select * from jsonb_array_elements(p_suits) loop
    select string_agg(format('%I = r.%I', c.column_name, c.column_name), ', ')
      into sets
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'orders'
       and suit ? c.column_name
       and c.column_name <> all(locked);
    if sets is null then
      continue;
    end if;
    execute format(
      'update public.orders o set %s from jsonb_populate_record(null::public.orders, $1) r where o.id = $2 and o.order_id = $3',
      sets)
    using suit, (suit->>'id')::uuid, p_order_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.admin_update_order(text, jsonb) from public, anon;
grant execute on function public.admin_update_order(text, jsonb) to authenticated;
