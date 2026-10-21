-- Factory (Kute Tailor) code lists, pulled by the kute-factory edge function
-- ("sync" action). Each row is one code list -- for crafts, one per garment
-- category -- exactly as the factory returned it. Used to turn the site's
-- option names into the factory codes an API order needs.
-- Safe to re-run.

create table if not exists public.factory_codes (
  list text not null,               -- categories, crafts, fits, ...
  category text not null default '',-- garment category code (crafts only)
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (list, category)
);

alter table public.factory_codes enable row level security;

do $$ begin
  create policy "admin reads factory codes" on public.factory_codes
    for select using (public.is_admin());
exception when duplicate_object then null;
end $$;
