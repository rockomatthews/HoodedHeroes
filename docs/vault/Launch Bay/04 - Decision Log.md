# Decision Log

## LB-ADR-001 — One polished launch mode first

Accepted: fixed-price, timed, pro-rata fair launch.  
Reason: predictable math, visible caps, refundability, and cross-chain equivalence are easier to audit than a menu of unrelated mechanisms.

## LB-ADR-002 — One manifest, separate audited adapters

Accepted: Robinhood Chain and Base share the EVM suite; Solana receives an independent program and audit.  
Reason: consistent economics do not justify pretending different execution models share the same security implementation.

## LB-ADR-003 — Repository-native Obsidian vault

Accepted: Markdown knowledge graph under `docs/vault`.  
Reason: decisions, threats, tests, and release evidence should evolve through the same pull-request controls as code. Personal Obsidian state remains untracked.

## LB-ADR-004 — Manifest-bound Hero reward routing

Accepted: every EVM launch commits one chain-specific Hero reward vault as its immutable fee recipient. The manifest, unsigned execution input, and server configuration must agree exactly. Native quote fees are wrapped before entering equal-per-Hero accounting.
Reason: a visible percentage is meaningless if the recipient can change at signing time; one reconciled vault creates a public, auditable community-fee ledger.
