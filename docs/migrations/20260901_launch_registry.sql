begin;

alter table if exists launches add column if not exists factory_address text;

alter table if exists liquidity_positions add column if not exists token_address text;
alter table if exists liquidity_positions add column if not exists quote_token_address text;
alter table if exists liquidity_positions add column if not exists venue_identifier text;
alter table if exists liquidity_positions add column if not exists pool_id text;
alter table if exists liquidity_positions add column if not exists fee integer;
alter table if exists liquidity_positions add column if not exists tick_spacing integer;
alter table if exists liquidity_positions add column if not exists hook_address text;
alter table if exists liquidity_positions add column if not exists finalization_transaction_hash text;

create table if not exists launch_provider_readiness (
  project_id text not null references launches(project_id),
  provider text not null check (provider in ('mancer', 'lifi')),
  status text not null default 'unverified' check (status in ('unverified', 'confirmed', 'rejected')),
  evidence_url text,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, provider)
);

create index if not exists launches_robinhood_token_idx
  on launches (lower(token_address))
  where chain = 'robinhood' and token_address is not null;

commit;
