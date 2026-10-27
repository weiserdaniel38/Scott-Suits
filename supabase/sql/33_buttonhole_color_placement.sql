-- Run once (Claude runs it with the Supabase connector when the PR merges).
--
-- Adds the column for the jacket's "Which Buttonholes Get the Color" step:
-- where the Front & Sleeve Buttonhole Color goes (Front & Sleeves, Sleeves
-- Only, or Bottom Sleeve Buttonhole). Empty on older orders, which means
-- Front & Sleeves.
--
-- Safe to re-run: "add column if not exists" skips it if it's already there.

alter table public.orders
  add column if not exists jacket_buttonhole_color_placement text;

-- Make the API see the new column right away.
notify pgrst, 'reload schema';
