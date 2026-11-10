-- Shipping labels bought from the admin's All Orders list (safe to re-run).
--
-- The shipping-label edge function quotes carrier rates through Shippo for
-- an order's address, and when the admin taps "Buy label" it buys the one
-- picked, saves it here, puts the tracking number on the order, marks it
-- "Shipped to you" and emails the customer (send-shipping-update).
--
-- Kept in its own table, not on orders, so customers (who can read their
-- own order rows) never see what the label cost. No policies: only the edge
-- function (service role) writes it, and the admin reads it through
-- admin_order_labels() below. cost_usd is the real label price, for the
-- profit numbers.

create table if not exists public.shipping_labels (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  order_id text not null,
  status text not null default 'bought',      -- bought, refund_pending, refunded
  test_mode boolean not null default false,   -- bought with a Shippo test key (free, not a real label)
  carrier text,
  service text,
  tracking_number text,
  tracking_url text,
  label_url text,
  cost_usd numeric,
  parcel jsonb,
  shippo_transaction_id text,
  shippo_rate_id text,
  refund_id text,
  refunded_at timestamptz,
  bought_by text
);
alter table public.shipping_labels enable row level security;
create index if not exists shipping_labels_order on public.shipping_labels (order_id, created_at);

create or replace function public.admin_order_labels(p_limit int default 1000)
returns table (
  id bigint,
  created_at timestamptz,
  order_id text,
  status text,
  test_mode boolean,
  carrier text,
  service text,
  tracking_number text,
  tracking_url text,
  label_url text,
  cost_usd numeric,
  parcel jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the shop admin can see shipping labels';
  end if;
  return query
    select l.id, l.created_at, l.order_id, l.status, l.test_mode, l.carrier, l.service, l.tracking_number,
           l.tracking_url, l.label_url, l.cost_usd, l.parcel
      from public.shipping_labels l
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;
revoke all on function public.admin_order_labels(int) from public, anon;
grant execute on function public.admin_order_labels(int) to authenticated;

notify pgrst, 'reload schema';
