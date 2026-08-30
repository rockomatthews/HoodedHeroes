import "server-only";

import { cache } from "react";
import { HERO_GENESIS_MANIFEST, type LaunchManifestV1 } from "@hoodedheroes/shared";
import { databaseConfigured, db } from "./database";

export const getPublicLaunch = cache(async (projectId: string): Promise<LaunchManifestV1 | null> => {
  if (projectId === HERO_GENESIS_MANIFEST.metadata.projectId && !databaseConfigured()) return HERO_GENESIS_MANIFEST;
  if (!databaseConfigured()) return null;
  const sql = db();
  const rows = await sql`select manifest from launches where project_id = ${projectId} limit 1`;
  return rows[0] ? (rows[0] as Record<string, unknown>).manifest as LaunchManifestV1 : null;
});
