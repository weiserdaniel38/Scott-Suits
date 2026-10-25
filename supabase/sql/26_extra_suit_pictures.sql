-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Extra suit pictures for one account for a while (Daniel can grant a
-- customer more than the usual PREVIEW_PER_ACCOUNT_PER_DAY). The
-- generate-suit-image function adds `extra` to that account's daily limit
-- until `expires_at`. Only the function (service role) reads it.
--
-- Grant example:
--   insert into public.preview_allowances (user_id, extra, expires_at, note)
--   select id, 10, now() + interval '24 hours', 'why' from auth.users
--   where lower(email) = 'someone@example.com'
--   on conflict (user_id) do update set extra = excluded.extra,
--     expires_at = excluded.expires_at, note = excluded.note;
--
-- Safe to re-run.

create table if not exists public.preview_allowances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  extra integer not null check (extra >= 0),
  expires_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.preview_allowances enable row level security;
