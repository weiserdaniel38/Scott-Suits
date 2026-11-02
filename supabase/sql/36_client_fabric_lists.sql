-- Client fabric lists (safe to re-run).
--
-- The shop admin can give one customer account its own short list of
-- fabrics (My Account > Client Fabric Lists). While that customer is signed
-- in, the Fabric step shows ONLY those fabrics, under their own heading
-- (e.g. "Picked for you"). Everyone else sees the normal fabric list.
-- First use (2026-11-01): Dovid's Rich Slate Blue ran out at the factory, so
-- he gets six in-stock navy/blue fabrics in the same price range.
--
-- fabrics holds the catalog's fabric names (catalog.js option name); the
-- website only ever shows their display names.

create table if not exists public.client_fabric_lists (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  label text not null default 'Picked for you',
  fabrics text[] not null default '{}',
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No policies: customers read their own list through my_fabric_list(), the
-- admin through the admin_* functions below.
alter table public.client_fabric_lists enable row level security;
revoke all on public.client_fabric_lists from public, anon, authenticated;

-- The signed-in customer's own list (no row when they have none).
create or replace function public.my_fabric_list()
returns table (label text, fabrics text[])
language sql
stable
security definer
set search_path = public
as $$
  select l.label, l.fabrics
    from public.client_fabric_lists l
   where l.active
     and cardinality(l.fabrics) > 0
     and l.email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function public.my_fabric_list() from public, anon;
grant execute on function public.my_fabric_list() to authenticated;

create or replace function public.admin_list_client_fabrics()
returns table (email text, label text, fabrics text[], note text, active boolean, has_account boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see client fabric lists';
  end if;
  return query
    select l.email, l.label, l.fabrics, l.note, l.active,
           exists (select 1 from auth.users u where lower(u.email) = l.email),
           l.updated_at
      from public.client_fabric_lists l
     order by l.updated_at desc;
end;
$$;
revoke all on function public.admin_list_client_fabrics() from public, anon;
grant execute on function public.admin_list_client_fabrics() to authenticated;

-- Adds or replaces a customer's list. An empty p_fabrics removes it.
create or replace function public.admin_save_client_fabrics(p_email text, p_fabrics text[], p_label text default null, p_note text default null, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_fabrics text[];
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change client fabric lists';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter the customer''s account email';
  end if;
  select coalesce(array_agg(distinct btrim(f)) filter (where btrim(f) <> ''), '{}')
    into v_fabrics from unnest(coalesce(p_fabrics, '{}')) f;
  if cardinality(v_fabrics) = 0 then
    delete from public.client_fabric_lists where email = v_email;
    return;
  end if;
  insert into public.client_fabric_lists (email, label, fabrics, note, active)
  values (v_email, coalesce(nullif(btrim(p_label), ''), 'Picked for you'), v_fabrics, coalesce(p_note, ''), coalesce(p_active, true))
  on conflict (email) do update
     set label = excluded.label, fabrics = excluded.fabrics, note = excluded.note,
         active = excluded.active, updated_at = now();
end;
$$;
revoke all on function public.admin_save_client_fabrics(text, text[], text, text, boolean) from public, anon;
grant execute on function public.admin_save_client_fabrics(text, text[], text, text, boolean) to authenticated;

create or replace function public.admin_delete_client_fabrics(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change client fabric lists';
  end if;
  delete from public.client_fabric_lists where email = lower(btrim(coalesce(p_email, '')));
end;
$$;
revoke all on function public.admin_delete_client_fabrics(text) from public, anon;
grant execute on function public.admin_delete_client_fabrics(text) to authenticated;

-- No starting lists: Dovid's (2026-11-01) was dropped on 2026-11-02 when he
-- chose to wait for Rich Slate Blue to come back in stock.
