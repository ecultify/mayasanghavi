#!/usr/bin/env node
// Apply the committed Drizzle migrations (./drizzle) to DATABASE_URL at startup
// so a fresh Railway Postgres gets the schema (rules, send_log, run_summary)
// before the app serves traffic.
//
// Safe on every deploy:
//   - If the schema already exists (for example created by an earlier
//     drizzle-kit push, which leaves no migration journal), it is detected and
//     migration is skipped, avoiding "type already exists" errors.
//   - It never blocks app startup: any unexpected error is logged and the
//     process still exits 0, so `next start` runs and the app surfaces any real
//     database problem in its own views instead of crash looping.

import { config } from "dotenv";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Load .env.local (local dev); on Railway the env is already populated.
config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("[migrate] DATABASE_URL is not set, skipping migrations.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString });

try {
  // to_regclass returns the table name if it exists, otherwise null.
  const { rows } = await pool.query(
    "select to_regclass('public.send_log') as t",
  );
  const schemaPresent = Boolean(rows[0]?.t);

  if (schemaPresent) {
    console.log("[migrate] schema already present, skipping migrations.");
  } else {
    const db = drizzle(pool);
    console.log("[migrate] applying migrations from ./drizzle ...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[migrate] done. Schema is up to date.");
  }
} catch (err) {
  // Do not crash loop the deploy on a migration hiccup; let the app start.
  console.error(
    "[migrate] error (continuing to start the app):",
    err?.message ?? err,
  );
} finally {
  await pool.end();
}

// Always succeed so the start command proceeds to `next start`.
process.exit(0);
