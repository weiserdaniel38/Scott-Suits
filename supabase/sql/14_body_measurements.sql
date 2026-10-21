-- Body measurements (safe to re-run; run after 13_factory_orders.sql).
--
-- Customers can give their body measurements and pick a fit instead of
-- finished suit sizes; the factory adds its own allowances. measure_type is
-- 'finished' or 'body'; body_* values are in cm.

alter table public.orders
  add column if not exists measure_type text,
  add column if not exists jacket_fit text,
  add column if not exists pants_fit text,
  add column if not exists body_neck numeric,
  add column if not exists body_chest numeric,
  add column if not exists body_stomach numeric,
  add column if not exists body_seat numeric,
  add column if not exists body_bicep numeric,
  add column if not exists body_shoulder numeric,
  add column if not exists body_sleeve numeric,
  add column if not exists body_nape_waist numeric,
  add column if not exists body_back_length numeric,
  add column if not exists body_front_waist numeric,
  add column if not exists body_waist numeric,
  add column if not exists body_thigh numeric,
  add column if not exists body_u_rise numeric,
  add column if not exists body_front_waist_h numeric,
  add column if not exists body_back_waist_h numeric,
  add column if not exists body_outseam numeric;
