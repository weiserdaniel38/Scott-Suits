-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Adds the column for the jacket's new "Buttonhole Thread Color" step (the
-- thread around the front and sleeve buttonholes; the lapel buttonhole keeps
-- its own jacket_buttonhole_thread_color column). Until this runs, orders
-- still save -- the choice is in client_form_text -- just without its own column.
--
-- Safe to re-run: "add column if not exists" skips it if it's already there.

alter table public.orders
  add column if not exists jacket_front_buttonhole_thread_color text;

-- Make the API see the new column right away.
notify pgrst, 'reload schema';
