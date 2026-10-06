-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Finished-suit picture feature, part 1 of 2 (safe to re-run).
--   * orders.visual_spec -- plain-English suit description the site already
--     tries to save on every order (main.js buildVisualSpecText). Until this
--     column exists the site quietly saves orders without it.
--   * orders.status      -- 'received' for new orders; you set it to
--     'completed' when the suit is done, and that's what draws the picture.
--   * orders.image_*     -- the picture's link, the prompt used, and whether
--     it is pending / done / failed (with the error message if it failed).
--   * a public `suit-images` storage bucket the pictures are saved in.
-- Part 2 (2_suit_image_trigger.sql) connects "status = completed" to the
-- image function, after the function and its secrets are set up.

alter table public.orders
  add column if not exists visual_spec text,
  add column if not exists status text not null default 'received',
  add column if not exists image_status text,
  add column if not exists image_url text,
  add column if not exists image_prompt text,
  add column if not exists image_error text,
  add column if not exists image_updated_at timestamptz;

-- Customers can insert orders from the website, so make sure they can't
-- pre-fill the shop-only fields (e.g. insert an order already "completed",
-- or point image_url at some other site). The shop and the image function
-- (service role / SQL editor) are unaffected.
create or replace function public.orders_reset_shop_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.status := 'received';
    new.image_status := null;
    new.image_url := null;
    new.image_prompt := null;
    new.image_error := null;
    new.image_updated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_reset_shop_fields on public.orders;
create trigger orders_reset_shop_fields
  before insert on public.orders
  for each row execute function public.orders_reset_shop_fields();

-- Pictures are readable by link (they're shown under Past Orders). Only the
-- image function (service role) can write; no public upload policy.
insert into storage.buckets (id, name, public)
values ('suit-images', 'suit-images', true)
on conflict (id) do nothing;
