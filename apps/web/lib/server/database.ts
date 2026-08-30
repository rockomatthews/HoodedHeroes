import "server-only";

import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  client ??= postgres(process.env.DATABASE_URL, { max: 4, idle_timeout: 20, connect_timeout: 10, prepare: false });
  return client;
}
