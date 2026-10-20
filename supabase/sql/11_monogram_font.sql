-- Adds the columns for the new "Monogram Font" step (factory fonts RC01-RC11;
-- the stored value is the factory's font name, e.g. "Old English", and the
-- code is on the order form). Until this runs, orders still save -- the
-- choice is in client_form_text -- just without its own column.
--
-- Safe to re-run: "add column if not exists" skips it if it's already there.

alter table public.orders
  add column if not exists jacket_monogram_font text,
  add column if not exists pants_monogram_font text;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
