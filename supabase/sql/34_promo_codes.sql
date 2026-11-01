-- Promo codes (safe to re-run).
--
-- The shop admin makes codes in My Account > Promo Codes. Each code takes
-- dollars off, a percent off, or both (percent first, then dollars), off the
-- suits + Alteration Protection, never off shipping or tax. A code can be
-- kept to certain customer accounts (by their account email; blank = anyone),
-- used once per customer (default), capped at a number of uses in total,
-- given an end date, and turned off.
--
-- Customers never read this table. The stripe-checkout edge function checks
-- a code (action "promo_check") and, when the order is paid for, works the
-- discount out again from this table and the saved order, so nothing the
-- website sends can change the price. What was taken off is saved on the
-- order (promo_code, promo_discount_usd).

create table if not exists public.promo_codes (
  id bigint generated always as identity primary key,
  code text not null,
  amount_off_usd numeric not null default 0 check (amount_off_usd >= 0 and amount_off_usd <= 20000),
  percent_off numeric not null default 0 check (percent_off >= 0 and percent_off <= 100),
  allowed_emails text[] not null default '{}',
  allowed_user_ids uuid[] not null default '{}',
  max_uses int check (max_uses is null or max_uses > 0),
  once_per_customer boolean not null default true,
  expires_on date,
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists promo_codes_code_key on public.promo_codes (upper(code));

-- No policies: only the admin functions below and the edge function
-- (service role) touch it.
alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from public, anon, authenticated;

alter table public.orders
  add column if not exists promo_code text,
  add column if not exists promo_discount_usd numeric;

-- An order saved from the website may name a code, but never its discount
-- (only the stripe-checkout function sets that).
create or replace function public.orders_reset_promo()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.promo_discount_usd := null;
    new.promo_code := nullif(upper(btrim(coalesce(new.promo_code, ''))), '');
  end if;
  return new;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_reset_promo' and tgrelid = 'public.orders'::regclass) then
    create trigger orders_reset_promo
      before insert on public.orders
      for each row execute function public.orders_reset_promo();
  end if;
end;
$$;

-- Paid orders that used a code, one per order (an order has a row per suit).
create or replace function public.promo_code_uses(p_code text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct o.order_id)::int
    from public.orders o
   where o.promo_code = upper(btrim(p_code))
     and coalesce(o.promo_discount_usd, 0) > 0
     and o.payment_status = 'paid';
$$;
revoke all on function public.promo_code_uses(text) from public, anon, authenticated;

create or replace function public.admin_list_promo_codes()
returns table (
  id bigint,
  code text,
  amount_off_usd numeric,
  percent_off numeric,
  allowed_emails text[],
  max_uses int,
  once_per_customer boolean,
  expires_on date,
  active boolean,
  note text,
  uses int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see promo codes';
  end if;
  return query
    select p.id, p.code, p.amount_off_usd, p.percent_off, p.allowed_emails, p.max_uses,
           p.once_per_customer, p.expires_on, p.active, p.note,
           public.promo_code_uses(p.code), p.created_at
      from public.promo_codes p
     order by p.created_at desc;
end;
$$;
revoke all on function public.admin_list_promo_codes() from public, anon;
grant execute on function public.admin_list_promo_codes() to authenticated;

-- Adds a code (p_id null) or changes one. p_emails: account emails,
-- separated by commas, spaces or new lines; blank = any customer. Every
-- email must already have an account, so nobody else can sign up with it
-- later and use the code.
create or replace function public.admin_save_promo_code(
  p_id bigint,
  p_code text,
  p_amount_off_usd numeric,
  p_percent_off numeric,
  p_emails text,
  p_max_uses int,
  p_once_per_customer boolean,
  p_expires_on date,
  p_active boolean,
  p_note text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_emails text[];
  v_ids uuid[] := '{}';
  v_missing text[] := '{}';
  v_email text;
  v_uid uuid;
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change promo codes';
  end if;
  if v_code !~ '^[A-Z0-9_-]{3,30}$' then
    raise exception 'The code must be 3 to 30 letters or numbers (dashes and underscores are OK, no spaces).';
  end if;
  if coalesce(p_amount_off_usd, 0) < 0 or coalesce(p_percent_off, 0) < 0 or coalesce(p_percent_off, 0) > 100 then
    raise exception 'Dollars off can''t be negative, and percent off must be between 0 and 100.';
  end if;
  if coalesce(p_amount_off_usd, 0) = 0 and coalesce(p_percent_off, 0) = 0 then
    raise exception 'Set dollars off, percent off, or both.';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'Max uses must be at least 1 (or blank for no limit).';
  end if;

  select coalesce(array_agg(distinct e order by e), '{}')
    into v_emails
    from unnest(regexp_split_to_array(lower(btrim(coalesce(p_emails, ''))), '[\s,;]+')) as e
   where e <> '';
  foreach v_email in array v_emails loop
    select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
    if v_uid is null then
      v_missing := v_missing || v_email;
    else
      v_ids := v_ids || v_uid;
    end if;
    v_uid := null;
  end loop;
  if array_length(v_missing, 1) > 0 then
    raise exception 'No account yet for: %. Ask the customer to make an account on the site first, then save the code again.', array_to_string(v_missing, ', ');
  end if;

  if exists (select 1 from public.promo_codes p where upper(p.code) = v_code and p.id is distinct from p_id) then
    raise exception 'There is already a code called %.', v_code;
  end if;

  if p_id is null then
    insert into public.promo_codes (code, amount_off_usd, percent_off, allowed_emails, allowed_user_ids, max_uses, once_per_customer, expires_on, active, note)
    values (v_code, coalesce(p_amount_off_usd, 0), coalesce(p_percent_off, 0), v_emails, v_ids, p_max_uses,
            coalesce(p_once_per_customer, true), p_expires_on, coalesce(p_active, true), coalesce(p_note, ''))
    returning id into v_id;
  else
    update public.promo_codes
       set code = v_code,
           amount_off_usd = coalesce(p_amount_off_usd, 0),
           percent_off = coalesce(p_percent_off, 0),
           allowed_emails = v_emails,
           allowed_user_ids = v_ids,
           max_uses = p_max_uses,
           once_per_customer = coalesce(p_once_per_customer, true),
           expires_on = p_expires_on,
           active = coalesce(p_active, true),
           note = coalesce(p_note, ''),
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'That promo code doesn''t exist any more.';
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_save_promo_code(bigint, text, numeric, numeric, text, int, boolean, date, boolean, text) from public, anon;
grant execute on function public.admin_save_promo_code(bigint, text, numeric, numeric, text, int, boolean, date, boolean, text) to authenticated;

create or replace function public.admin_set_promo_active(p_id bigint, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change promo codes';
  end if;
  update public.promo_codes set active = coalesce(p_active, false), updated_at = now() where id = p_id;
end;
$$;
revoke all on function public.admin_set_promo_active(bigint, boolean) from public, anon;
grant execute on function public.admin_set_promo_active(bigint, boolean) to authenticated;

-- Only a code nobody has used can be removed (a used one can be turned off).
create or replace function public.admin_delete_promo_code(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change promo codes';
  end if;
  select code into v_code from public.promo_codes where id = p_id;
  if v_code is null then
    return;
  end if;
  if exists (select 1 from public.orders o where o.promo_code = upper(v_code) and coalesce(o.promo_discount_usd, 0) > 0) then
    raise exception 'This code has been used on an order, so it can only be turned off.';
  end if;
  delete from public.promo_codes where id = p_id;
end;
$$;
revoke all on function public.admin_delete_promo_code(bigint) from public, anon;
grant execute on function public.admin_delete_promo_code(bigint) to authenticated;

-- Code and discount per order, for the admin's All Orders list.
create or replace function public.admin_order_promos(p_limit int default 1000)
returns table (
  order_id text,
  promo_code text,
  promo_discount_usd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see this';
  end if;
  return query
    select o.order_id, max(o.promo_code), max(o.promo_discount_usd)
      from public.orders o
     where o.order_id is not null and o.promo_code is not null
     group by o.order_id
     order by min(o.created_at) desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_promos(int) from public, anon;
grant execute on function public.admin_order_promos(int) to authenticated;

notify pgrst, 'reload schema';
