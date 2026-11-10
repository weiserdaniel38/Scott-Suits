-- Cart on every device (2026-11-10): a signed-in customer's cart is saved on
-- their profile so a suit added on the phone also shows up on the PC.
-- The existing "update/insert/select their own profile" policies cover it.
alter table public.profiles add column if not exists cart jsonb;
