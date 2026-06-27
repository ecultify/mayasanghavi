#!/usr/bin/env node
// Apply the committed Drizzle migrations (./drizzle) to DATABASE_URL.
// Runs at web service startup so the Railway Postgres always has the schema
// (rules, send_log, run_summary) before the app serves traffic. Idempotent:
// Drizzle records applied migrations and skips them on re-run.

import { config } from "dotenv";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Load .env.local (local dev); on Railway the env is already populated.
config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Do not crash the whole start if the DB is intentionally absent; just warn.
  console.warn("[migrate] DATABASE_URL is not set, skipping migrations.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString });

try {
  const db = drizzle(pool);
  console.log("[migrate] applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done. Schema is up to date.");
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
