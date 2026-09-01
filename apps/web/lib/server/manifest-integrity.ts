import "server-only";

import { createHash } from "node:crypto";
import { verifyMessage } from "viem";
import { canonicalJson, launchMetadataImmutableCore, metadataRevisionAttestation, metadataRevisionPayload, type LaunchManifestV1, type LaunchMetadataV1 } from "@hooded/shared";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function computedMetadataRevisionHash(manifest: LaunchManifestV1) {
  return computedLaunchMetadataRevisionHash(manifest.metadata);
}

export function computedLaunchMetadataRevisionHash(metadata: LaunchMetadataV1) {
  return sha256(canonicalJson(metadataRevisionPayload(metadata)));
}

export function manifestRecordHash(manifest: LaunchManifestV1) {
  return sha256(canonicalJson(manifest));
}

export function immutableMetadataCoreMatches(metadata: LaunchMetadataV1) {
  return sha256(canonicalJson(launchMetadataImmutableCore(metadata))) === metadata.immutableCoreHash.toLowerCase();
}

export function metadataRevisionMatches(manifest: LaunchManifestV1) {
  return computedMetadataRevisionHash(manifest) === manifest.metadata.revision.contentHash.toLowerCase();
}

export async function metadataRevisionSignatureValid(manifest: LaunchManifestV1) {
  return launchMetadataRevisionSignatureValid(manifest.metadata);
}

export async function launchMetadataRevisionSignatureValid(metadata: LaunchMetadataV1) {
  if (!/^0x[a-fA-F0-9]{130}$/.test(metadata.revision.signature)) return false;
  return verifyMessage({
    address: metadata.revision.authorWallet as `0x${string}`,
    message: metadataRevisionAttestation(metadata),
    signature: metadata.revision.signature as `0x${string}`,
  });
}
