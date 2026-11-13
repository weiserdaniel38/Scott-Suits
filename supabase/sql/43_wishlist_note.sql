-- Wishlist (2026-11-13): no schema change. A signed-in customer's wishlist
-- is stored in the existing profiles.cart jsonb under the key "wishlist"
-- (see 39_profile_cart.sql), written by the site with the customer's own
-- profile policies. The cart sync keeps that key when it saves the cart.
select 1;
