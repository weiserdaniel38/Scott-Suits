-- Vests (2026-11-18): a 3-piece suit (suit_type 'three_piece') or a vest
-- on its own ('vest_only'). The vest's choices are saved together in
-- `vest`, keyed by each step's column in VEST_CATALOG (catalog.js); the
-- vest measurements are their own columns like every other measurement.
alter table public.orders add column if not exists vest jsonb;
alter table public.orders add column if not exists vest_chest numeric;
alter table public.orders add column if not exists vest_stomach numeric;
alter table public.orders add column if not exists vest_length numeric;
alter table public.orders add column if not exists body_vest_length numeric;
