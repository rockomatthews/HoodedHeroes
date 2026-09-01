# HOODED Genesis generative system

`scripts/generate-hero-collection.mjs` deterministically creates 3,000 original SVG Heroes and matching metadata without using Robinhood marks or existing comic-franchise characters.

- Recruit IDs: 1–2,200, including free Founder IDs 1–10.
- Specialist IDs: 2,201–2,800.
- Vanguard IDs: 2,801–2,980.
- Icon IDs: 2,981–3,000.
- Traits: color signal, mask, emblem, aura, tier code, and power index.
- Tier affects energy, gear capacity, ability choice, and appearance—not reward weight.
- The generator rejects duplicate record fingerprints and emits SHA-256 image/metadata hashes plus one ordered collection root.

Generated files live under ignored `art/generated/heroes` until their image-CID placeholder is replaced and the final directory is pinned. The current deterministic rehearsal produced 3,000 records with zero collisions and root `46fe5471d69bde43a3754e391a29beab2834dc95bcc8ad8cd5f1039815e75c56`; this root is evidence for the unpinned rehearsal only and must not be deployed as the final IPFS root.
