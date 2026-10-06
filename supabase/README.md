# Supabase backend pieces

- `sql/1_add_order_status_and_suit_image_migration.sql`: order status, image columns, `suit-images` bucket.
- `functions/generate-suit-image/index.ts`: draws the finished suit when an order is marked completed.
- `sql/2_suit_image_trigger.sql`: calls the function when `status` becomes `completed` (fill in the webhook secret before running).

The website itself does not use these files; API keys live only in Supabase Edge Function secrets.
