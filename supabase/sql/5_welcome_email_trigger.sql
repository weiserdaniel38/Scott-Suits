-- Run this once in the Supabase Dashboard: SQL Editor > New query > paste > Run.
--
-- Welcome email: OPTIONAL (safe to re-run). Sends every new customer a
-- "your Scott Suits account is ready" email the moment their account is
-- created, whether they signed up with email + password or with Google.
-- Run it AFTER the send-welcome-email function is deployed and its
-- RESEND_API_KEY and WEBHOOK_SECRET are saved under Edge Functions > Secrets.
--
-- Replace PASTE_WEBHOOK_SECRET_HERE with the exact WEBHOOK_SECRET value.
--
-- The call happens in the background (pg_net), so a problem sending the
-- email never stops the account from being created.

create extension if not exists pg_net;

create or replace function public.request_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://nvlhngzycldysosvhglx.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-webhook-secret', 'PASTE_WEBHOOK_SECRET_HERE'
    ),
    body := jsonb_build_object('user_id', new.id)
  );
  return new;
end;
$$;

revoke all on function public.request_welcome_email() from public, anon, authenticated;

drop trigger if exists auth_users_welcome_email on auth.users;
create trigger auth_users_welcome_email
  after insert on auth.users
  for each row
  when (new.email is not null and new.is_anonymous is not true)
  execute function public.request_welcome_email();
