-- The suit's reference at the factory (customerNo) when it isn't the usual
-- SS-<order>-<suit no.>: set when a draft deleted on the factory site had to
-- be saved again under a new reference, because the factory's duplicate
-- check still counts deleted drafts (2026-11-12, Nathan Friedman's suit).
-- Applied 2026-11-12.
alter table public.orders add column if not exists factory_ref text;
comment on column public.orders.factory_ref is 'Suit reference (customerNo) sent to the factory when it differs from the default SS-<order>-<suit>, e.g. after a draft was deleted on the factory site.';
