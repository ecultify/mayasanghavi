import { requireBearer, jsonOk, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthReport {
  databaseUrlSet: boolean;
  connected: boolean;
  tables: { rules: boolean; send_log: boolean; run_summary: boolean };
  counts: { rules: number; send_log: number; run_summary: number } | null;
  error: string | null;
}

// GET /api/health
// Reports whether the database is reachable and whether the schema (rules,
// send_log, run_summary) exists, with row counts. Use this to verify a deploy.
export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const report: HealthReport = {
      databaseUrlSet: Boolean(process.env.DATABASE_URL),
      connected: false,
      tables: { rules: false, send_log: false, run_summary: false },
      counts: null,
      error: null,
    };

    try {
      const existsRes = await db.execute(
        sql`select to_regclass('public.rules') as rules, to_regclass('public.send_log') as send_log, to_regclass('public.run_summary') as run_summary`,
      );
      const row = existsRes.rows[0] as Record<string, unknown>;
      report.connected = true;
      report.tables = {
        rules: Boolean(row.rules),
        send_log: Boolean(row.send_log),
        run_summary: Boolean(row.run_summary),
      };

      if (report.tables.send_log && report.tables.rules && report.tables.run_summary) {
        const countRes = await db.execute(
          sql`select
            (select count(*) from rules)::int as rules,
            (select count(*) from send_log)::int as send_log,
            (select count(*) from run_summary)::int as run_summary`,
        );
        const c = countRes.rows[0] as Record<string, number>;
        report.counts = {
          rules: c.rules,
          send_log: c.send_log,
          run_summary: c.run_summary,
        };
      }
    } catch (err) {
      report.error = err instanceof Error ? err.message : String(err);
    }

    return jsonOk(report);
  });
}
