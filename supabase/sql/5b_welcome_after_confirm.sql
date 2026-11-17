-- Welcome email waits for a confirmed email (Daniel, 2026-11-17).
--
-- Accounts made with email + password now start unconfirmed and get a
-- "Confirm your email" message first (edge function send-signup-confirmation).
-- So the welcome email goes out:
--   * right away for accounts that start confirmed (Continue with Google,
--     admin "Measure a Client" walk-ins), and
--   * the moment an email + password account confirms its email.
-- Reuses public.request_welcome_email() from 5_welcome_email_trigger.sql
-- unchanged (it holds the webhook secret, so it is not re-created here).

drop trigger if exists auth_users_welcome_email on auth.users;
create trigger auth_users_welcome_email
  after insert on auth.users
  for each row
  when (new.email is not null and new.is_anonymous is not true and new.email_confirmed_at is not null)
  execute function public.request_welcome_email();

drop trigger if exists auth_users_welcome_on_confirm on auth.users;
create trigger auth_users_welcome_on_confirm
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null
        and new.email is not null and new.is_anonymous is not true)
  execute function public.request_welcome_email();
