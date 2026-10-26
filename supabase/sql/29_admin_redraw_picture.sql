-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Admin "Redraw picture" on All Orders: clears one suit's picture so the
-- generate-suit-image function draws it again from the order's saved design
-- (the admin page then asks it to draw, like the customer's own button).
-- Admin only. Safe to re-run.

create or replace function public.admin_reset_picture(p_order_id text, p_suit_number int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can redraw pictures';
  end if;
  update public.orders
     set image_status = null, image_error = null
   where order_id = p_order_id and suit_number = p_suit_number;
  return found;
end;
$$;
revoke all on function public.admin_reset_picture(text, int) from public, anon;
grant execute on function public.admin_reset_picture(text, int) to authenticated;

notify pgrst, 'reload schema';
