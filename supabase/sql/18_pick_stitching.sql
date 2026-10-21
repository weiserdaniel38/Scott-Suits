-- Pick stitching choices for the jacket and trousers (catalog.js
-- JACKET_CATALOG.pickStitch / PANTS_CATALOG.pickStitch). Safe to re-run.
alter table public.orders
  add column if not exists jacket_pick_stitch text,
  add column if not exists pants_pick_stitch text;
