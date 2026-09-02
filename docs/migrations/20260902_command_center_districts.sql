begin;

create table if not exists hero_loadout_drafts (
  wallet_address text primary key references society_members(wallet_address),
  ability text not null check (ability in ('GRID SURGE', 'DRONE VEIL', 'CIPHER SIGHT')),
  gear text not null check (gear in ('ARC RELAY', 'SIGNAL CLOAK', 'RESCUE BEACON')),
  updated_at timestamptz not null default now()
);

commit;
