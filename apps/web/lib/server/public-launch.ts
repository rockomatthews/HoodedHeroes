import "server-only";

import { cache } from "react";
import { HLAB1_MANIFEST, HLAB2_MANIFEST, HOODED_GENESIS_MANIFEST, type LaunchManifestV1 } from "@hooded/shared";
import { databaseConfigured, db } from "./database";

export const getPublicLaunch = cache(async (projectId: string): Promise<LaunchManifestV1 | null> => {
  const bundled = [HOODED_GENESIS_MANIFEST, HLAB1_MANIFEST, HLAB2_MANIFEST].find((launch) => launch.metadata.projectId === projectId);
  if (bundled && !databaseConfigured()) return bundled;
  if (!databaseConfigured()) return null;
  const sql = db();
  const rows = await sql`select manifest from launches where project_id = ${projectId} limit 1`;
  return rows[0] ? (rows[0] as Record<string, unknown>).manifest as LaunchManifestV1 : null;
});
