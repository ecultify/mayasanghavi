import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Lazily create the pool/db so importing this module never throws (the build
// and any non-DB code path must not require DATABASE_URL). The friendly error
// surfaces on first actual query instead.
const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __db?: NodePgDatabase<typeof schema>;
};

function getDb(): NodePgDatabase<typeof schema> {
  if (globalForDb.__db) return globalForDb.__db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (local) or the Railway Variables panel (deploy).",
    );
  }

  const pool =
    globalForDb.__pgPool ?? new Pool({ connectionString, max: 5 });
  const instance = drizzle(pool, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__pgPool = pool;
    globalForDb.__db = instance;
  }
  return instance;
}

// Proxy so existing `db.select()` call sites work unchanged while construction
// stays deferred until the first property access.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
