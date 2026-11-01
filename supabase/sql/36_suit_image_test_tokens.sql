-- Tokens for test drawings of the suit picture (generate-suit-image,
-- x-test-token header): only the SHA-256 of each token is stored. RLS is on
-- with no policies, so only SQL and the service role can read or add rows.
create table if not exists public.suit_image_test_tokens (
  token_hash text primary key,
  expires_at timestamptz not null
);
alter table public.suit_image_test_tokens enable row level security;
revoke all on public.suit_image_test_tokens from anon, authenticated;
