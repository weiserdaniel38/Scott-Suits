-- Delete a promo code from My Account > Promo Codes (safe to re-run).
--
-- The row is kept (so old orders still name a real code) but taken out of
-- use and out of the admin list: it's marked deleted, turned off, and
-- renamed (CODE~del~<id>) so the same code name can be made again later.

alter table public.promo_codes add column if not exists deleted_at timestamptz;

create or replace function public.admin_delete_promo_code(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can change promo codes';
  end if;
  update public.promo_codes
     set active = false,
         deleted_at = now(),
         code = left(code, 30) || '~del~' || id,
         updated_at = now()
   where id = p_id and deleted_at is null;
end;
$$;
revoke all on function public.admin_delete_promo_code(bigint) from public, anon;
grant execute on function public.admin_delete_promo_code(bigint) to authenticated;

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
     where p.deleted_at is null
     order by p.created_at desc;
end;
$$;

notify pgrst, 'reload schema';
