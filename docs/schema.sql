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
