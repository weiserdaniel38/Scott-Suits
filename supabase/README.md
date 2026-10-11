# Supabase backend pieces

- `sql/1_add_order_status_and_suit_image_migration.sql`: order status, image columns, `suit-images` bucket.
- `functions/generate-suit-image/index.ts`: draws the finished-suit picture sheet (confirmation page "Generate My Suit" button, Past Orders).
- `sql/2_suit_image_trigger.sql` (optional): also draws it when `status` becomes `completed` (fill in the webhook secret before running).
- `functions/send-welcome-email/index.ts`: emails each new customer a "your Scott Suits account is ready" message (sent through Resend).
- `sql/5_welcome_email_trigger.sql`: calls it whenever a new account is created (fill in the webhook secret before running).
- `sql/6_admin_account.sql`: makes one account the shop admin (no picture limit, "Place order without payment" on the order page; those orders have `admin_no_payment = true`).

The website itself does not use these files; API keys live only in Supabase Edge Function secrets.
