-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Finished-suit picture feature, part 1 of 2 (safe to re-run).
--   * orders.visual_spec -- plain-English suit description the site already
--     tries to save on every order (main.js buildVisualSpecText). Until this
--     column exists the site quietly saves orders without it.
--   * orders.status      -- 'received' for new orders; you set it to
--     'completed' when the suit is done.
--   * orders.image_*     -- the picture's link, the prompt used, and whether
--     it is pending / done / failed (with the error message if it failed).
--   * a `suit_previews` table for pictures drawn before ordering.
--   * a public `suit-images` storage bucket the pictures are saved in.
-- Part 2 (2_suit_image_trigger.sql, optional) also draws a picture when you
-- mark an order completed.

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

-- "Generate My Suit" previews drawn while the customer is still designing,
-- before any order exists. Only the image function (service role) reads or
-- writes this table; `visitor` is a one-way hash used for the daily limit.
create table if not exists public.suit_previews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  visitor text,
  visual_spec text,
  status text,
  image_url text,
  image_prompt text,
  image_error text
);
alter table public.suit_previews enable row level security;
create index if not exists suit_previews_visitor_created on public.suit_previews (visitor, created_at);
create index if not exists suit_previews_created on public.suit_previews (created_at);

-- Pictures are readable by link (they're shown under Past Orders). Only the
-- image function (service role) can write; no public upload policy.
insert into storage.buckets (id, name, public)
values ('suit-images', 'suit-images', true)
on conflict (id) do nothing;
