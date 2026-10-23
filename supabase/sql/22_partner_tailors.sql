-- Partner tailors: shops that measure customers for Scott's Suits. Shown on
-- the Measurements step ("Find a tailor near you"), closest first to the
-- ZIP code the customer types. The shop admin adds, edits and removes them
-- in My Account > Partner Tailors. Safe to re-run.
--
-- lat/lng are filled in by the admin screen when a tailor is saved (looked
-- up from the address with Geoapify, the same service as the address
-- autocomplete). Hidden tailors (active = false) stay in the list for the
-- admin but are never shown to customers.

create table if not exists public.partner_tailors (
  id bigint generated always as identity primary key,
  name text not null,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  phone text not null default '',
  website text not null default '',
  hours text not null default '',
  note text not null default '',
  lat double precision,
  lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_tailors enable row level security;

revoke all on public.partner_tailors from public, anon, authenticated;
grant select on public.partner_tailors to anon, authenticated;
grant insert, update, delete on public.partner_tailors to authenticated;

-- Everyone can see active tailors; the admin sees all of them.
drop policy if exists partner_tailors_read on public.partner_tailors;
create policy partner_tailors_read on public.partner_tailors
  for select to anon, authenticated
  using (active or public.is_admin());

-- Only the admin can add, change or remove tailors.
drop policy if exists partner_tailors_admin_insert on public.partner_tailors;
create policy partner_tailors_admin_insert on public.partner_tailors
  for insert to authenticated
  with check (public.is_admin());
drop policy if exists partner_tailors_admin_update on public.partner_tailors;
create policy partner_tailors_admin_update on public.partner_tailors
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists partner_tailors_admin_delete on public.partner_tailors;
create policy partner_tailors_admin_delete on public.partner_tailors
  for delete to authenticated
  using (public.is_admin());

create or replace function public.partner_tailors_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists partner_tailors_touch on public.partner_tailors;
create trigger partner_tailors_touch
  before update on public.partner_tailors
  for each row execute function public.partner_tailors_touch();

-- First partner tailors (lat/lng looked up with Geoapify).
insert into public.partner_tailors (name, address, city, state, zip, lat, lng)
select 'Saveway Cleaners', '947 Allwood Rd', 'Clifton', 'NJ', '07012',
       40.8523, -74.1730
 where not exists (select 1 from public.partner_tailors where name = 'Saveway Cleaners');
insert into public.partner_tailors (name, address, city, state, zip, lat, lng)
select 'Ziker Cleaners & Joe Z Tailoring', '2330 South Bend Ave', 'South Bend', 'IN', '46635',
       41.7007, -86.2149
 where not exists (select 1 from public.partner_tailors where name = 'Ziker Cleaners & Joe Z Tailoring');
insert into public.partner_tailors (name, address, city, state, zip, lat, lng)
select 'Tambi Tailoring & Alterations', '1051 Bloomfield Ave, Suite 165', 'Clifton', 'NJ', '07012',
       40.8418, -74.1602
 where not exists (select 1 from public.partner_tailors where name = 'Tambi Tailoring & Alterations');
insert into public.partner_tailors (name, address, city, state, zip, lat, lng)
select 'Giorgio''s Tailoring & Menswear', '73 Park Ave', 'Park Ridge', 'NJ', '07656',
       41.0331, -74.0368
 where not exists (select 1 from public.partner_tailors where name = 'Giorgio''s Tailoring & Menswear');
insert into public.partner_tailors (name, address, city, state, zip, lat, lng)
select 'Twin Brothers Custom Made Tailor Shop', '155 S Middletown Rd', 'Nanuet', 'NY', '10954',
       41.0916, -74.0130
 where not exists (select 1 from public.partner_tailors where name = 'Twin Brothers Custom Made Tailor Shop');
insert into public.partner_tailors (name, address, city, state, zip, note, lat, lng)
select 'Valley Cleaners, Inc.', '5 Spring Valley Market Pl', 'Spring Valley', 'NY', '10977',
       'The tailor is not in on Fridays from 12 to 3 pm.', 41.1060, -74.0290
 where not exists (select 1 from public.partner_tailors where name = 'Valley Cleaners, Inc.');

notify pgrst, 'reload schema';
