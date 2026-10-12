-- Factory progress stages for shipping updates (safe to re-run; run after
-- 8_shipping_updates.sql).
--
-- Customers see each step: sent to the factory, fabric cut, sewn,
-- finishing, on its way from the factory, final inspection with the shop,
-- shipped to them, out for delivery, delivered.

-- The earlier single "Being made" step becomes "Being sewn".
update public.orders set shipping_status = 'sewing' where shipping_status = 'in_production';

create or replace function public.admin_update_shipping(
  p_order_id text,
  p_status text,
  p_carrier text default null,
  p_tracking text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can update shipping';
  end if;
  if p_status is not null and p_status not in (
    'sent_to_factory', 'cutting', 'sewing', 'finishing', 'factory_shipped',
    'final_check', 'shipped', 'out_for_delivery', 'delivered'
  ) then
    raise exception 'Unknown shipping status %', p_status;
  end if;
  update public.orders
     set shipping_status = p_status,
         tracking_carrier = nullif(btrim(coalesce(p_carrier, '')), ''),
         tracking_number = nullif(btrim(coalesce(p_tracking, '')), ''),
         shipping_updated_at = now()
   where order_id = p_order_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_update_shipping(text, text, text, text) from public, anon;
grant execute on function public.admin_update_shipping(text, text, text, text) to authenticated;
