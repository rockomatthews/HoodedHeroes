import { buildRobinhoodTokenList, type LaunchManifestV1 } from "@hooded/shared";
import { getAddress, isAddress } from "viem";

export type ProviderReadinessStatus = "unverified" | "confirmed" | "rejected";
export type RegistryLaunchRow = { project_id: string; chain: string; lifecycle: string; token_address: string | null; sale_address: string | null; factory_address: string | null; manifest_hash: string; manifest: LaunchManifestV1 };
export type RegistryPositionRow = { coordinator_address: string; lock_address: string; position_manager: string; position_id: string | number | bigint | null; token_address: string | null; quote_token_address: string | null; venue_identifier: string | null; pool_id: string | null; fee: number | null; tick_spacing: number | null; hook_address: string | null; finalization_transaction_hash: string | null; permanently_locked: boolean; verified_at: Date | string | null };
export type RegistryEventRow = { event_name: string; transaction_hash: string };
export type RegistryProviderRow = { provider: "mancer" | "lifi"; status: ProviderReadinessStatus; evidence_url: string | null; confirmed_at: Date | string | null };
export type RegistrySource = { launch: RegistryLaunchRow; position?: RegistryPositionRow | null; events?: RegistryEventRow[]; providers?: RegistryProviderRow[] };

const validAddress = (value: string | null | undefined) => Boolean(value && isAddress(value));
const validHash = (value: string | null | undefined) => Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));
const transactionFor = (events: RegistryEventRow[], names: string[]) => events.find((event) => names.includes(event.event_name))?.transaction_hash ?? null;

export function buildRobinhoodRegistryRecord(input: RegistrySource) {
  const { launch, position = null, events = [], providers = [] } = input;
  if (launch.chain !== "robinhood" || !validAddress(launch.token_address)) return null;
  const tokenAddress = getAddress(launch.token_address!);
  if (launch.manifest.metadata.chain !== "robinhood" || !launch.manifest.metadata.tokenAddress || !isAddress(launch.manifest.metadata.tokenAddress) || getAddress(launch.manifest.metadata.tokenAddress) !== tokenAddress) return null;
  const creationTx = transactionFor(events, ["LaunchCreated"]);
  const activationTx = transactionFor(events, ["Activated"]);
  const finalizationTx = position?.finalization_transaction_hash ?? transactionFor(events, ["CanonicalPoolActivated", "LiquidityFinalized"]);
  const poolComplete = Boolean(position && validAddress(position.token_address) && getAddress(position.token_address!) === tokenAddress
    && validAddress(position.quote_token_address) && validHash(position.venue_identifier) && validHash(position.pool_id)
    && position.fee && position.fee > 0 && position.tick_spacing && position.tick_spacing > 0
    && validAddress(position.hook_address) && validAddress(position.coordinator_address) && validAddress(position.position_manager)
    && position.position_id !== null && BigInt(position.position_id!) > 0n && validAddress(position.lock_address)
    && position.permanently_locked && position.verified_at && validHash(finalizationTx));
  const missing: string[] = [];
  if (!validAddress(launch.factory_address)) missing.push("factory");
  if (!validAddress(launch.sale_address)) missing.push("sale");
  if (!validHash(creationTx)) missing.push("creation-transaction");
  if (!validHash(activationTx)) missing.push("activation-transaction");
  if (!poolComplete) missing.push("verified-canonical-pool");
  if (!validHash(finalizationTx)) missing.push("finalization-transaction");
  if (launch.lifecycle !== "public-eligible") missing.push("public-eligible-lifecycle");
  const tradable = missing.length === 0;
  const readiness = (provider: "mancer" | "lifi") => {
    const row = providers.find((entry) => entry.provider === provider);
    return { status: row?.status ?? "unverified" as ProviderReadinessStatus, evidenceUrl: row?.evidence_url ?? null, confirmedAt: row?.confirmed_at ? new Date(row.confirmed_at).toISOString() : null };
  };
  return {
    schema: "hooded.launch-registry/v1" as const,
    chainId: 4663,
    launcher: { name: "Hooded" as const, url: "https://hooded.world" },
    lifecycle: launch.lifecycle,
    status: tradable ? "tradable" as const : "incomplete" as const,
    tradable,
    incompleteReasons: missing,
    token: { address: tokenAddress, name: launch.manifest.metadata.name, symbol: launch.manifest.metadata.symbol, decimals: launch.manifest.metadata.decimals, exactSupply: launch.manifest.metadata.exactSupply },
    manifest: { projectId: launch.project_id, hash: launch.manifest_hash, schemaVersion: launch.manifest.manifestVersion, sourceCommit: launch.manifest.metadata.sourceCommit, buildHash: launch.manifest.metadata.buildHash },
    factory: { address: validAddress(launch.factory_address) ? getAddress(launch.factory_address!) : null, version: launch.manifest.metadata.factoryVersion, saleAddress: validAddress(launch.sale_address) ? getAddress(launch.sale_address!) : null },
    canonicalPool: poolComplete && position ? {
      token: getAddress(position.token_address!), quoteToken: getAddress(position.quote_token_address!), venueId: position.venue_identifier, poolId: position.pool_id,
      fee: position.fee, tickSpacing: position.tick_spacing, hook: getAddress(position.hook_address!), positionId: String(position.position_id),
      positionLock: getAddress(position.lock_address), coordinator: getAddress(position.coordinator_address), positionManager: getAddress(position.position_manager),
      permanentlyLocked: true as const, verifiedAt: new Date(position.verified_at!).toISOString(),
    } : null,
    publication: {
      launchPage: launch.manifest.metadata.canonicalLaunchUrl,
      explorer: launch.manifest.metadata.explorerUrl ?? null,
      website: launch.manifest.metadata.publication.website,
      docs: launch.manifest.metadata.publication.docs ?? null,
      x: launch.manifest.metadata.publication.x ?? null,
      telegram: launch.manifest.metadata.publication.telegram ?? null,
      discord: launch.manifest.metadata.publication.discord ?? null,
      farcaster: launch.manifest.metadata.publication.farcaster ?? null,
      support: launch.manifest.metadata.publication.support ?? null,
      image: launch.manifest.metadata.publication.image,
      header: launch.manifest.metadata.publication.header ?? null,
    },
    transactionHashes: { creation: validHash(creationTx) ? creationTx : null, activation: validHash(activationTx) ? activationTx : null, finalization: validHash(finalizationTx) ? finalizationTx : null },
    providerReadiness: { mancer: readiness("mancer"), lifi: readiness("lifi") },
  };
}

export function buildRobinhoodTokenListFromRegistrySources(sources: RegistrySource[], timestamp: string) {
  const metadata = sources.flatMap((source) => buildRobinhoodRegistryRecord(source)?.tradable ? [source.launch.manifest.metadata] : []);
  return buildRobinhoodTokenList(metadata, timestamp);
}

export function robinhoodRegistryHttpResult(record: ReturnType<typeof buildRobinhoodRegistryRecord>) {
  return record
    ? { status: 200 as const, body: record }
    : { status: 404 as const, body: { error: "Robinhood Chain launch not found" } };
}
