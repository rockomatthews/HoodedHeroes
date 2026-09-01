import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(process.argv[2] || "art/generated/heroes");
const imageDir = resolve(output, "images");
const metadataDir = resolve(output, "metadata");
mkdirSync(imageDir, { recursive: true });
mkdirSync(metadataDir, { recursive: true });

const palette = ["#F23838", "#2376FF", "#39D353", "#FFD52E", "#9A4DFF", "#FF7A1A"];
const masks = ["SLIT", "ARC", "VOLT", "VOID", "PRISM", "CIPHER"];
const emblems = ["BOLT", "STAR", "GRID", "EYE", "FLAME", "KEY"];
const auras = ["HALFTONE", "RAYS", "STATIC", "RINGS", "CITY", "SHARDS"];

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function pick(seed, values, offset) { return values[Number.parseInt(seed.slice(offset, offset + 8), 16) % values.length]; }
function tierFor(tokenId) {
  if (tokenId <= 2200) return "Recruit";
  if (tokenId <= 2800) return "Specialist";
  if (tokenId <= 2980) return "Vanguard";
  return "Icon";
}
function tierNumber(tier) { return { Recruit: "01", Specialist: "02", Vanguard: "03", Icon: "04" }[tier]; }

function svgFor(tokenId, traits, seed) {
  const secondary = palette[(palette.indexOf(traits.color) + 2 + tokenId % 3) % palette.length];
  const eye = traits.tier === "Icon" ? "#FFD52E" : "#FFF7DF";
  const rays = Array.from({ length: 18 }, (_, index) => {
    const angle = index * 20;
    return `<path d="M512 512 L512 70 L548 70 Z" transform="rotate(${angle} 512 512)" fill="${index % 2 ? traits.color : secondary}" opacity=".7"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="HOODED Genesis Hero ${tokenId}">
  <rect width="1024" height="1024" fill="#050505"/><g>${rays}</g>
  <circle cx="512" cy="512" r="430" fill="none" stroke="#050505" stroke-width="38"/><circle cx="512" cy="512" r="397" fill="none" stroke="#FFF7DF" stroke-width="12"/>
  <path d="M182 900 Q210 660 332 583 Q294 432 356 282 Q419 136 512 118 Q605 136 668 282 Q730 432 692 583 Q814 660 842 900Z" fill="#090909" stroke="#050505" stroke-width="34"/>
  <path d="M354 584 Q404 624 512 626 Q620 624 670 584 Q626 745 512 780 Q398 745 354 584Z" fill="${traits.color}" stroke="#050505" stroke-width="25"/>
  <path d="M344 444 Q392 308 512 274 Q632 308 680 444 Q632 554 512 566 Q392 554 344 444Z" fill="#020202" stroke="${secondary}" stroke-width="13"/>
  <path d="M390 432 Q438 392 488 422 Q442 482 394 470Z" fill="${eye}"/><path d="M634 432 Q586 392 536 422 Q582 482 630 470Z" fill="${eye}"/>
  <path d="M445 682 L512 646 L579 682 L558 754 L512 786 L466 754Z" fill="#050505" stroke="#FFF7DF" stroke-width="9"/>
  <text x="512" y="733" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="42" fill="${traits.color}">${traits.emblem.slice(0, 1)}</text>
  <path d="M130 116 H340 L305 208 H95Z" fill="${traits.color}" stroke="#050505" stroke-width="18"/><text x="214" y="174" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="49" fill="#050505">${traits.tier.toUpperCase()}</text>
  <path d="M690 820 H930 L890 928 H650Z" fill="#FFF7DF" stroke="#050505" stroke-width="18"/><text x="790" y="886" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="55" fill="#050505">#${String(tokenId).padStart(4, "0")}</text>
  <text x="512" y="965" text-anchor="middle" font-family="monospace" font-size="18" fill="#FFF7DF">HOODED // ${seed.slice(0, 16).toUpperCase()}</text></svg>`;
}

const seen = new Set();
const records = [];
for (let tokenId = 1; tokenId <= 3000; tokenId += 1) {
  const seed = hash(`HOODED-GENESIS-V1:${tokenId}`);
  const tier = tierFor(tokenId);
  const traits = {
    tier,
    founder: tokenId <= 10,
    color: pick(seed, palette, 0),
    mask: pick(seed, masks, 8),
    emblem: pick(seed, emblems, 16),
    aura: pick(seed, auras, 24),
    powerIndex: 1 + Number.parseInt(seed.slice(32, 40), 16) % 100,
  };
  const fingerprint = hash(JSON.stringify({ ...traits, tokenId }));
  if (seen.has(fingerprint)) throw new Error(`Trait collision at token ${tokenId}`);
  seen.add(fingerprint);
  const svg = svgFor(tokenId, traits, seed);
  const imageHash = hash(svg);
  writeFileSync(resolve(imageDir, `${tokenId}.svg`), svg);
  const metadata = {
    name: `HOODED ${tier} #${String(tokenId).padStart(4, "0")}`,
    description: "An original HOODED Genesis Hero. Origin tier affects energy, gear capacity, ability choice, and appearance—not reward weight.",
    image: `ipfs://__IMAGE_DIRECTORY_CID__/${tokenId}.svg`,
    external_url: `https://hooded.world/heroes/${tokenId}`,
    attributes: [
      { trait_type: "Origin Tier", value: tier },
      { trait_type: "Founder Grant", value: traits.founder ? "Yes" : "No" },
      { trait_type: "Color Signal", value: traits.color },
      { trait_type: "Mask", value: traits.mask },
      { trait_type: "Emblem", value: traits.emblem },
      { trait_type: "Aura", value: traits.aura },
      { trait_type: "Power Index", value: traits.powerIndex, max_value: 100 },
      { trait_type: "Tier Code", value: tierNumber(tier) },
    ],
    properties: { files: [{ uri: `ipfs://__IMAGE_DIRECTORY_CID__/${tokenId}.svg`, type: "image/svg+xml" }], category: "image", creators: [] },
  };
  const metadataJson = `${JSON.stringify(metadata, null, 2)}\n`;
  writeFileSync(resolve(metadataDir, String(tokenId)), metadataJson);
  records.push({ tokenId, tier, imageHash, metadataHash: hash(metadataJson), fingerprint });
}

const collectionRoot = hash(records.map((record) => `${record.tokenId}:${record.imageHash}:${record.metadataHash}`).join("\n"));
const manifest = {
  schema: "hooded-hero-collection/v1",
  supply: 3000,
  founderGrant: { tokenIds: [1, 10], count: 10, tier: "Recruit", price: 0, transferable: true },
  tierRanges: { Recruit: [1, 2200], Specialist: [2201, 2800], Vanguard: [2801, 2980], Icon: [2981, 3000] },
  collisionCount: 0,
  collectionRoot,
  generatedAt: new Date().toISOString(),
  records,
};
writeFileSync(resolve(output, "collection-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output, supply: 3000, collectionRoot, collisionCount: 0 }, null, 2));
