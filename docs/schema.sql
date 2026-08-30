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
  hero_balance numeric(78, 0) not null default 0,
  genesis_hero_balance numeric(78, 0) not null default 0,
  reputation integer not null default 0 check (reputation >= 0),
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table sandbox_sessions (
  id uuid primary key,
  idempotency_key text not null,
  owner_wallet text not null references society_members(wallet_address),
  repository text not null check (repository = 'rockomatthews/HoodedHeroes'),
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

create table contribution_proposals (
  id uuid primary key,
  session_id uuid not null references sandbox_sessions(id),
  author_wallet text not null references society_members(wallet_address),
  branch_name text not null check (branch_name like 'codex/%'),
  commit_sha text not null,
  build_hash text not null,
  test_evidence jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft', 'checks-passed', 'peer-reviewed', 'security-approved', 'merged', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launches (
  project_id text primary key,
  creator_wallet text not null references society_members(wallet_address),
  chain text not null check (chain in ('robinhood', 'base', 'solana')),
  environment text not null check (environment in ('testnet', 'mainnet-candidate')),
  lifecycle text not null,
  token_address text,
  manifest jsonb not null,
  manifest_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table metadata_revisions (
  project_id text not null references launches(project_id),
  version integer not null check (version > 0),
  content_hash text not null,
  previous_content_hash text,
  author_wallet text not null,
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

create index sandbox_sessions_owner_active_idx on sandbox_sessions(owner_wallet, expires_at desc);
create index launches_chain_lifecycle_idx on launches(chain, lifecycle, created_at desc);
create index launch_reviews_project_idx on launch_reviews(project_id, created_at desc);
