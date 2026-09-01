import "server-only";

import { createHash } from "node:crypto";
import { canonicalJson, metadataRevisionPayload, type LaunchManifestV1 } from "@hooded/shared";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function computedMetadataRevisionHash(manifest: LaunchManifestV1) {
  return sha256(canonicalJson(metadataRevisionPayload(manifest.metadata)));
}

export function manifestRecordHash(manifest: LaunchManifestV1) {
  return sha256(canonicalJson(manifest));
}

export function metadataRevisionMatches(manifest: LaunchManifestV1) {
  return computedMetadataRevisionHash(manifest) === manifest.metadata.revision.contentHash.toLowerCase();
}
