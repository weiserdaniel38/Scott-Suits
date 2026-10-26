-- Customer reviews: shown at the bottom of the landing page ("What our
-- customers say"). Anyone can leave one with the "Leave a review" form, but
-- it stays hidden until the shop admin approves it in My Account > Reviews.
-- Only real customer reviews go here (the FTC's 2024 rule bans made-up
-- reviews). Safe to re-run.

create table if not exists public.customer_reviews (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 40),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
alter table public.customer_reviews enable row level security;

-- The website may only fill in name, rating and text. approved,
-- created_at and approved_at can't be set from the form.
revoke all on public.customer_reviews from public, anon, authenticated;
grant select on public.customer_reviews to anon, authenticated;
grant insert (name, rating, body) on public.customer_reviews to anon, authenticated;
grant update (approved), delete on public.customer_reviews to authenticated;

drop policy if exists customer_reviews_read on public.customer_reviews;
create policy customer_reviews_read on public.customer_reviews
  for select to anon, authenticated
  using (approved or public.is_admin());

drop policy if exists customer_reviews_submit on public.customer_reviews;
create policy customer_reviews_submit on public.customer_reviews
  for insert to anon, authenticated
  with check (not approved);

drop policy if exists customer_reviews_admin_update on public.customer_reviews;
create policy customer_reviews_admin_update on public.customer_reviews
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists customer_reviews_admin_delete on public.customer_reviews;
create policy customer_reviews_admin_delete on public.customer_reviews
  for delete to authenticated
  using (public.is_admin());

-- Names are saved as first name + last initial ("Yitzy Zimmerman" ->
-- "Yitzy Z."), so a full last name is never stored or shown. Also stamps
-- approved_at when a review is approved.
create or replace function public.customer_reviews_tidy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parts text[];
begin
  if tg_op = 'INSERT' then
    parts := regexp_split_to_array(btrim(regexp_replace(new.name, '\s+', ' ', 'g')), ' ');
    new.name := parts[1];
    if array_length(parts, 1) > 1 then
      new.name := new.name || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.';
    end if;
    new.body := btrim(new.body);
  end if;
  if new.approved and (tg_op = 'INSERT' or not old.approved) then
    new.approved_at := now();
  elsif not new.approved then
    new.approved_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists customer_reviews_tidy on public.customer_reviews;
create trigger customer_reviews_tidy
  before insert or update on public.customer_reviews
  for each row execute function public.customer_reviews_tidy();

create index if not exists customer_reviews_approved_idx
  on public.customer_reviews (approved, approved_at desc);

notify pgrst, 'reload schema';
