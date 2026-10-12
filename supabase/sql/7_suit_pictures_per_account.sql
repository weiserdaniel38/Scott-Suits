-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Suit pictures need a signed-in account, and each account can draw 3 a day
-- (PREVIEW_PER_ACCOUNT_PER_DAY in the generate-suit-image function; the shop
-- admin has no limit). This records which account each preview belongs to
-- so the function can count them.
--
-- Safe to re-run.

alter table public.suit_previews
  add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists suit_previews_user_created on public.suit_previews (user_id, created_at);
