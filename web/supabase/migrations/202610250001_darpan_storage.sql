-- Darpan private persistence. Apply in the Supabase SQL editor or with the CLI.
-- Service role is used only by server-side Vercel functions; no anon/authenticated
-- policies are created for these tables or the object bucket.

create table if not exists public.darpan_state (
  key text primary key check (length(key) between 1 and 512),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint darpan_state_value_bounded check (octet_length(value::text) <= 262144)
);
alter table public.darpan_state enable row level security;
revoke all on public.darpan_state from public, anon, authenticated;
grant select, insert, update, delete on public.darpan_state to service_role;

create table if not exists public.darpan_leases (
  key text primary key check (length(key) between 1 and 512),
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.darpan_leases enable row level security;
revoke all on public.darpan_leases from public, anon, authenticated;
grant select, insert, update, delete on public.darpan_leases to service_role;

create table if not exists public.darpan_claims (
  key text primary key check (length(key) between 1 and 512),
  created_at timestamptz not null default now()
);
alter table public.darpan_claims enable row level security;
revoke all on public.darpan_claims from public, anon, authenticated;
grant select, insert, update, delete on public.darpan_claims to service_role;

create table if not exists public.darpan_visitor_quota (
  visitor_key text not null check (length(visitor_key) between 1 and 128),
  usage_date date not null,
  spent integer not null default 0 check (spent >= 0),
  primary key (visitor_key, usage_date)
);
alter table public.darpan_visitor_quota enable row level security;
revoke all on public.darpan_visitor_quota from public, anon, authenticated;
grant select, insert, update, delete on public.darpan_visitor_quota to service_role;

create or replace function public.darpan_claim_once(claim_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  insert into public.darpan_claims(key) values (claim_key) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end $$;

create or replace function public.darpan_acquire_lease(lease_key text, lease_token uuid, ttl_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  if ttl_seconds < 1 or ttl_seconds > 180 then raise exception 'invalid lease duration'; end if;
  insert into public.darpan_leases(key, token, expires_at)
    values (lease_key, lease_token, now() + make_interval(secs => ttl_seconds))
    on conflict (key) do update set token = excluded.token, expires_at = excluded.expires_at
      where public.darpan_leases.expires_at < now();
  get diagnostics inserted = row_count;
  return inserted = 1;
end $$;

create or replace function public.darpan_release_lease(lease_key text, lease_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.darpan_leases where key = lease_key and token = lease_token;
  get diagnostics removed = row_count;
  return removed = 1;
end $$;

create or replace function public.darpan_reserve_visitor_units(p_visitor_key text, p_usage_date date, p_units integer, p_cap integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if p_units < 1 or p_cap < 1 or length(p_visitor_key) > 128 then raise exception 'invalid quota request'; end if;
  if p_units > p_cap then return false; end if;
  insert into public.darpan_visitor_quota(visitor_key, usage_date, spent)
    values (p_visitor_key, p_usage_date, p_units)
    on conflict (visitor_key, usage_date) do update set spent = public.darpan_visitor_quota.spent + excluded.spent
      where public.darpan_visitor_quota.spent + excluded.spent <= p_cap;
  get diagnostics changed = row_count;
  return changed = 1;
end $$;

revoke all on function public.darpan_claim_once(text) from public, anon, authenticated;
revoke all on function public.darpan_acquire_lease(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.darpan_release_lease(text, uuid) from public, anon, authenticated;
revoke all on function public.darpan_reserve_visitor_units(text, date, integer, integer) from public, anon, authenticated;
grant execute on function public.darpan_claim_once(text) to service_role;
grant execute on function public.darpan_acquire_lease(text, uuid, integer) to service_role;
grant execute on function public.darpan_release_lease(text, uuid) to service_role;
grant execute on function public.darpan_reserve_visitor_units(text, date, integer, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('darpan-private', 'darpan-private', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit)
values ('darpan-staging', 'darpan-staging', false, 4194304)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
