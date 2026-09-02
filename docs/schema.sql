create table score_sessions (
  nonce text primary key,
  wallet_address text not null,
  seed bigint not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table mission_scores (
  id bigserial primary key,
  nonce text not null unique references score_sessions(nonce),
  wallet_address text not null,
  hero_id numeric(78, 0) not null,
  mission_id text not null,
  season integer not null,
  score integer not null check (score >= 0),
  trace_hash text not null,
  created_at timestamptz not null default now()
);

create table progression (
  hero_id numeric(78, 0) primary key,
  wallet_address text not null,
  reputation bigint not null default 0 check (reputation >= 0),
  salary_credits bigint not null default 0 check (salary_credits >= 0),
  renown bigint not null default 0 check (renown >= 0),
  rank text not null default 'Initiate',
  tenure_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stock_token_eligibility (
  wallet_address text primary key,
  provider_reference text not null,
  identity_verified boolean not null default false,
  jurisdiction_allowed boolean not null default false,
  sanctions_clear boolean not null default false,
  wallet_control_verified boolean not null default false,
  checked_at timestamptz not null,
  expires_at timestamptz not null
);

-- Score credit transaction: UPDATE the unconsumed nonce and insert the score in
-- one SERIALIZABLE transaction. A zero-row update means replay or expiry.

create table society_members (
  wallet_address text primary key,
  access_level text not null check (access_level in ('vestibule', 'preview', 'hero')),
  hooded_balance numeric(78, 0) not null default 0,
  genesis_hero_balance numeric(78, 0) not null default 0,
  reputation integer not null default 0 check (reputation >= 0),
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table hero_loadout_drafts (
  wallet_address text primary key references society_members(wallet_address),
  ability text not null check (ability in ('GRID SURGE', 'DRONE VEIL', 'CIPHER SIGHT')),
  gear text not null check (gear in ('ARC RELAY', 'SIGNAL CLOAK', 'RESCUE BEACON')),
  updated_at timestamptz not null default now()
);

create table sandbox_sessions (
  id uuid primary key,
  idempotency_key text not null,
  owner_wallet text not null references society_members(wallet_address),
  repository text not null check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  base_commit text not null check (base_commit ~ '^[a-fA-F0-9]{7,40}$'),
  runtime_image text not null check (runtime_image in ('web-evm-v1', 'solana-v1')),
  provider_session_id text not null unique,
  status text not null,
  preview_url text,
  snapshot_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_wallet, idempotency_key)
);

create table sandbox_runs (
  id text primary key,
  idempotency_key text not null,
  session_id uuid not null references sandbox_sessions(id),
  preset text not null check (preset in ('install', 'typecheck', 'test', 'build', 'contract-test', 'security-scan')),
  input_hash text not null,
  exit_code integer,
  stdout text not null default '',
  stderr text not null default '',
  output_hash text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (session_id, idempotency_key)
);

create table sandbox_file_changes (
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

create table contribution_proposals (
  id uuid primary key,
  session_id uuid not null references sandbox_sessions(id),
  author_wallet text not null references society_members(wallet_address),
  branch_name text not null check (branch_name like 'codex/%'),
  commit_sha text not null,
  build_hash text not null,
  test_evidence jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft', 'checks-passed', 'peer-reviewed', 'security-approved', 'merged', 'rejected')),
  pull_request_number integer,
  pull_request_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table github_accounts (
  wallet_address text primary key references society_members(wallet_address),
  github_user_id bigint not null unique,
  github_login text not null,
  avatar_url text not null,
  linked_at timestamptz not null,
  last_verified_at timestamptz not null
);

create table github_access_grants (
  wallet_address text not null references society_members(wallet_address),
  repository text not null check (repository ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  github_login text not null,
  status text not null check (status in ('active', 'revoked')),
  granted_at timestamptz not null,
  revoked_at timestamptz,
  last_verified_at timestamptz not null,
  primary key (wallet_address, repository)
);

create table launches (
  project_id text primary key,
  creator_wallet text not null references society_members(wallet_address),
  chain text not null check (chain in ('robinhood', 'base', 'solana')),
  environment text not null check (environment in ('mainnet-canary', 'mainnet')),
  launch_class text not null check (launch_class in ('lab', 'production')),
  lifecycle text not null,
  token_address text,
  sale_address text,
  factory_address text,
  manifest jsonb not null,
  manifest_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launch_events (
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

create table indexer_cursors (
  cursor_key text primary key,
  block_number numeric(78, 0) not null,
  block_hash text,
  updated_at timestamptz not null default now()
);

create table api_rate_limits (
  scope text not null,
  subject text not null,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, subject, bucket_start)
);

create table launch_contributions (
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

create table launch_eligibility_permits (
  project_id text not null references launches(project_id),
  wallet_address text not null,
  nonce numeric(78, 0) not null,
  allowance numeric(78, 0) not null,
  expires_at timestamptz not null,
  issued_at timestamptz not null default now(),
  consumed_at timestamptz,
  primary key (project_id, wallet_address, nonce)
);

create table wallet_screening_checks (
  id uuid primary key,
  wallet_address text not null,
  provider_reference text not null,
  sanctions_clear boolean not null,
  jurisdiction_allowed boolean not null,
  checked_at timestamptz not null,
  expires_at timestamptz not null
);

create table liquidity_positions (
  project_id text primary key references launches(project_id),
  coordinator_address text not null,
  lock_address text not null,
  position_manager text not null,
  position_id numeric(78, 0),
  token_address text,
  quote_token_address text,
  venue_identifier text,
  pool_id text,
  fee integer,
  tick_spacing integer,
  hook_address text,
  finalization_transaction_hash text,
  quote_amount numeric(78, 0) not null default 0,
  token_amount numeric(78, 0) not null default 0,
  permanently_locked boolean not null default false,
  verified_at timestamptz
);

create table launch_provider_readiness (
  project_id text not null references launches(project_id),
  provider text not null check (provider in ('mancer', 'lifi')),
  status text not null default 'unverified' check (status in ('unverified', 'confirmed', 'rejected')),
  evidence_url text,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, provider)
);

create table distribution_artifacts (
  project_id text not null references launches(project_id),
  artifact_type text not null,
  content_hash text not null,
  immutable_uri text,
  https_url text,
  validation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (project_id, artifact_type, content_hash)
);

create table hero_ownership_events (
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

create table metadata_revisions (
  project_id text not null references launches(project_id),
  version integer not null check (version > 0),
  content_hash text not null,
  previous_content_hash text,
  author_wallet text not null,
  signature text not null,
  publication jsonb not null,
  change_reason text not null,
  frozen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (project_id, version),
  unique (project_id, content_hash)
);

create table launch_reviews (
  id uuid primary key,
  project_id text not null references launches(project_id),
  reviewer_wallet text not null references society_members(wallet_address),
  kind text not null check (kind in ('peer', 'security', 'legal', 'audit')),
  decision text not null check (decision in ('approve', 'request-changes', 'reject')),
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  unique (project_id, reviewer_wallet, kind, evidence_hash)
);

create table community_messages (
  id uuid primary key,
  idempotency_key text not null,
  owner_wallet text not null references society_members(wallet_address),
  channel text not null check (channel in ('society', 'builders', 'launch-review', 'house-relay')),
  body text not null check (char_length(body) between 1 and 280),
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'review')),
  created_at timestamptz not null default now(),
  unique (owner_wallet, idempotency_key)
);

create index sandbox_sessions_owner_active_idx on sandbox_sessions(owner_wallet, expires_at desc);
create index launches_chain_lifecycle_idx on launches(chain, lifecycle, created_at desc);
create index launch_events_project_block_idx on launch_events(project_id, block_number desc);
create index launch_contributions_project_idx on launch_contributions(project_id, updated_at desc);
create index launch_reviews_project_idx on launch_reviews(project_id, created_at desc);
create index community_messages_visible_created_idx on community_messages(created_at desc) where moderation_status = 'visible';
create index community_messages_channel_created_idx on community_messages(channel, created_at desc) where moderation_status = 'visible';
create index community_messages_wallet_created_idx on community_messages(owner_wallet, created_at desc);
