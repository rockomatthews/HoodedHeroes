begin;

alter table if exists launches add column if not exists launch_class text;
alter table if exists launches add column if not exists sale_address text;
alter table if exists contribution_proposals add column if not exists pull_request_number integer;
alter table if exists contribution_proposals add column if not exists pull_request_url text;
alter table if exists metadata_revisions add column if not exists signature text not null default 'legacy-unsigned';

create table if not exists sandbox_file_changes (
  id bigserial primary key,
  session_id uuid not null references sandbox_sessions(id),
  idempotency_key text not null,
  path text not null,
  content_hash text not null,
  bytes integer not null check (bytes between 0 and 262144),
  author_wallet text not null references society_members(wallet_address),
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);

create table if not exists github_accounts (
  wallet_address text primary key references society_members(wallet_address),
  github_user_id bigint not null unique,
  github_login text not null,
  avatar_url text not null,
  linked_at timestamptz not null,
  last_verified_at timestamptz not null
);

create table if not exists github_access_grants (
  wallet_address text not null references society_members(wallet_address),
  repository text not null check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  github_login text not null,
  status text not null check (status in ('active', 'revoked')),
  granted_at timestamptz not null,
  revoked_at timestamptz,
  last_verified_at timestamptz not null,
  primary key (wallet_address, repository)
);

alter table sandbox_sessions drop constraint if exists sandbox_sessions_repository_check;
alter table sandbox_sessions add constraint sandbox_sessions_repository_check check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$');
alter table github_access_grants drop constraint if exists github_access_grants_repository_check;
alter table github_access_grants add constraint github_access_grants_repository_check check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$');

create table if not exists launch_events (
  chain_id integer not null,
  transaction_hash text not null,
  log_index integer not null,
  project_id text not null references launches(project_id),
  block_number numeric(78, 0) not null,
  event_name text not null,
  payload jsonb not null,
  observed_at timestamptz not null default now(),
  primary key (chain_id, transaction_hash, log_index)
);

create table if not exists api_rate_limits (
  scope text not null,
  subject text not null,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, subject, bucket_start)
);

create table if not exists indexer_cursors (
  cursor_key text primary key,
  block_number numeric(78, 0) not null,
  block_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists launch_contributions (
  project_id text not null references launches(project_id),
  wallet_address text not null,
  contributed numeric(78, 0) not null default 0,
  accepted numeric(78, 0) not null default 0,
  refunded numeric(78, 0) not null default 0,
  token_allocation numeric(78, 0) not null default 0,
  settled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (project_id, wallet_address)
);

create table if not exists launch_eligibility_permits (
  project_id text not null references launches(project_id),
  wallet_address text not null,
  nonce numeric(78, 0) not null,
  allowance numeric(78, 0) not null,
  expires_at timestamptz not null,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz,
  primary key (project_id, wallet_address, nonce)
);

create table if not exists wallet_screening_checks (
  id uuid primary key,
  wallet_address text not null,
  provider_reference text not null,
  sanctions_clear boolean not null,
  jurisdiction_allowed boolean not null,
  checked_at timestamptz not null,
  expires_at timestamptz not null
);

create table if not exists liquidity_positions (
  project_id text primary key references launches(project_id),
  coordinator_address text not null,
  lock_address text not null,
  position_manager text not null,
  position_id numeric(78, 0),
  quote_amount numeric(78, 0) not null default 0,
  token_amount numeric(78, 0) not null default 0,
  permanently_locked boolean not null default false,
  verified_at timestamptz
);

create table if not exists distribution_artifacts (
  project_id text not null references launches(project_id),
  artifact_type text not null,
  content_hash text not null,
  immutable_uri text,
  https_url text,
  validation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (project_id, artifact_type, content_hash)
);

create table if not exists hero_ownership_events (
  transaction_hash text not null,
  log_index integer not null,
  hero_id numeric(78, 0) not null,
  from_wallet text not null,
  to_wallet text not null,
  origin_tier text not null check (origin_tier in ('Recruit', 'Specialist', 'Vanguard', 'Icon')),
  progression_reset boolean not null,
  observed_at timestamptz not null default now(),
  primary key (transaction_hash, log_index)
);

create index if not exists launch_events_project_block_idx on launch_events(project_id, block_number desc);
create index if not exists launch_contributions_project_idx on launch_contributions(project_id, updated_at desc);

commit;
