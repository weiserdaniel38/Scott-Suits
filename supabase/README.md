# Supabase backend pieces

- `sql/1_add_order_status_and_suit_image_migration.sql`: order status, image columns, `suit-images` bucket.
- `functions/generate-suit-image/index.ts`: draws the finished-suit picture sheet (confirmation page "Generate My Suit" button, Past Orders).
- `sql/2_suit_image_trigger.sql` (optional): also draws it when `status` becomes `completed` (fill in the webhook secret before running).
- `functions/send-welcome-email/index.ts`: emails each new customer a "your Scott Suits account is ready" message (sent through Resend).
- `sql/5_welcome_email_trigger.sql`: calls it whenever a new account is created (fill in the webhook secret before running).
- `sql/9_factory_stages.sql`: the factory progress steps (sent to factory, cutting, sewing, finishing, from the factory, final inspection) before shipping.
- `sql/8_shipping_updates.sql`: shipping status + tracking on orders, the admin's All Orders & Shipping list in My Account, and test mode (updates go to the admin until "Send updates to customers" is on).
- `sql/10_admin_delete_order.sql`: lets the admin delete an order (all its suits) from that list, after confirming.
- `functions/send-shipping-update/index.ts`: emails (Resend) and texts (Twilio, once its secrets are set) the customer when the admin saves a shipping update.
- `sql/6_admin_account.sql`: makes one account the shop admin (no picture limit, "Place order without payment" on the order page; those orders have `admin_no_payment = true`).
- `sql/12_stripe_payments.sql`: payment status on orders (`awaiting_payment` -> `paid`, set only by the Stripe function) and payment info for the admin's Orders list.
- `functions/stripe-checkout/index.ts`: Stripe checkout. Opens Stripe's payment page for a saved order, confirms the payment with Stripe when the customer comes back, and removes the unpaid order if they cancel. Needs the `STRIPE_SECRET_KEY` secret; `STRIPE_WEBHOOK_SECRET` is optional.

The website itself does not use these files; API keys live only in Supabase Edge Function secrets.
