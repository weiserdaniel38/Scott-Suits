-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Adds the columns for four designer choices the site already saves on every
-- order but the orders table doesn't have yet: Lapel Buttonhole, Jacket
-- Lining, Felt Under Collar and Button Color. Without them every order failed
-- to save ("column orders.button_color does not exist"). The site now saves
-- orders without these columns if they're missing (the choices are still in
-- client_form_text), but run this so each one gets its own column again.
--
-- Safe to re-run: "add column if not exists" skips anything already there.

alter table public.orders
  add column if not exists lapel_buttonhole text,
  add column if not exists jacket_lining text,
  add column if not exists felt_under_collar text,
  add column if not exists button_color text;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
