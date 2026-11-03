-- Applied 2026-11-03 with the Supabase connector (apply_migration).
--
-- Adds the column for the jacket's "Lapel Buttonhole Style" step: Machine
-- Sewn, or one of the factory's handmade lapel buttonhole styles. Empty on
-- older orders, which means Machine Sewn.

alter table public.orders
  add column if not exists jacket_lapel_buttonhole_style text;

notify pgrst, 'reload schema';
