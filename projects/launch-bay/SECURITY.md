# Launch Bay security policy

Do not publish an exploitable vulnerability in chat, an issue, or a public pull request. Report it privately to the designated security contact once that channel is configured. Until then, document only non-sensitive hardening work and keep exploit details off public branches.

No code in this repository is audited or approved for mainnet. A passing test suite is evidence, not proof of safety.

Release-blocking invariants include exact fixed supply, conservation of sale tokens and quote assets, contribution caps, deterministic pro-rata rounding, permissionless refunds, single settlement, immutable fee caps and recipients, enforceable vesting, inaccessible locked liquidity, revoked mint/freeze authorities, and no owner withdrawal path.

