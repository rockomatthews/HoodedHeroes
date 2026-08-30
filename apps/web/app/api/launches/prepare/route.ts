import { validateLaunchManifest, type LaunchManifestV1 } from "@hoodedheroes/shared";

export async function POST(request: Request) {
  const manifest = await request.json() as LaunchManifestV1;
  const validation = validateLaunchManifest(manifest);
  if (!validation.ready) return Response.json({ error: "Manifest is blocked", validation }, { status: 422 });
  const factory = manifest.metadata.chain === "base" ? process.env.BASE_LAUNCH_FACTORY_ADDRESS : manifest.metadata.chain === "robinhood" ? process.env.RH_LAUNCH_FACTORY_ADDRESS : process.env.SOLANA_LAUNCH_PROGRAM_ID;
  if (!factory) return Response.json({ prepared: false, reason: "The audited testnet factory/program address is not configured. No transaction was generated.", validation }, { status: 503 });
  if (manifest.lifecycle !== "testnet-proven" && manifest.lifecycle !== "mainnet-eligible") return Response.json({ prepared: false, reason: "The proposal has not completed the required review lifecycle.", validation }, { status: 403 });
  return Response.json({ prepared: false, reason: "Transaction encoding remains disabled until the configured deployment is verified against the audited build hash.", factory, validation }, { status: 503 });
}
