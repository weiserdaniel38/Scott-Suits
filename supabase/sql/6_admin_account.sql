-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Shop admin account. The account listed here can draw as many suit
-- pictures as it wants (the picture limits never apply to it) and gets a
-- "Place order without payment" button on the order page. Those orders are
-- saved with admin_no_payment = true.
--
-- BEFORE RUNNING: sign in on scottssuits.com with the admin email once, so
-- the account exists. The admin is stored by account id, not by typing an
-- email on the site: someone else signing up later with a look-alike or the
-- same address can't become admin.
--
-- To add another admin later, run only the "insert" block below with their
-- email. To remove one: delete from public.admins where email = '...';
--
-- Safe to re-run.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  added_at timestamptz not null default now()
);
-- No policies on purpose: the website can't read or change this table.
alter table public.admins enable row level security;

-- >>> Change the email here if your admin account uses a different one. <<<
insert into public.admins (user_id, email)
select id, email from auth.users where lower(email) = lower('weiserdaniel38@gmail.com')
on conflict (user_id) do nothing;

-- True only for a signed-in admin. The website calls this to decide whether
-- to show the admin button; the real protection is the check below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.orders
  add column if not exists admin_no_payment boolean not null default false;

-- Only an admin can save an order marked "no payment". Anyone else trying
-- it (for example by editing the page) gets an error and nothing is saved.
create or replace function public.orders_admin_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.admin_no_payment is not distinct from old.admin_no_payment then
    return new;
  end if;
  if new.admin_no_payment and not public.is_admin() then
    raise exception 'Only the shop admin can place an order without payment';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_admin_guard on public.orders;
create trigger orders_admin_guard
  before insert or update on public.orders
  for each row execute function public.orders_admin_guard();

-- Make the API see the new column right away.
notify pgrst, 'reload schema';

-- Should show one row with your email. No rows means that email has no
-- account yet: sign in on the site with it, then run this file again.
select user_id, email from public.admins;
