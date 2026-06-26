import { db } from "@/lib/db";
import { runSummary, rules } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export interface RunSummaryRow {
  id: number;
  runDate: string;
  ruleId: number | null;
  ruleName: string | null;
  matched: number;
  sent: number;
  failed: number;
  deduped: number;
  skippedInvalid: number;
  durationMs: number;
  createdAt: string;
}

// Recent automation runs (one row per rule per execution), newest first, with
// the rule name joined in so staff can see when each rule ran and what happened.
export async function listRunSummaries(limit = 50): Promise<RunSummaryRow[]> {
  const rows = await db
    .select({
      id: runSummary.id,
      runDate: runSummary.runDate,
      ruleId: runSummary.ruleId,
      ruleName: rules.name,
      matched: runSummary.matched,
      sent: runSummary.sent,
      failed: runSummary.failed,
      deduped: runSummary.deduped,
      skippedInvalid: runSummary.skippedInvalid,
      durationMs: runSummary.durationMs,
      createdAt: runSummary.createdAt,
    })
    .from(runSummary)
    .leftJoin(rules, eq(runSummary.ruleId, rules.id))
    .orderBy(desc(runSummary.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
