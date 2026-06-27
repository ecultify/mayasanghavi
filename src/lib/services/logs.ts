import { db } from "@/lib/db";
import { sendLog, runSummary } from "@/lib/db/schema";
import type { SendLog } from "@/lib/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { todayInRunTz } from "@/lib/time";

export interface LogFilter {
  date?: string; // YYYY-MM-DD, or "today"
  status?: "sent" | "failed" | "skipped_dupe" | "skipped_invalid";
  ruleId?: number;
}

export async function listLogs(filter: LogFilter = {}): Promise<SendLog[]> {
  const conditions = [];
  if (filter.date) {
    const date = filter.date === "today" ? todayInRunTz() : filter.date;
    conditions.push(eq(sendLog.runDate, date));
  }
  if (filter.status) conditions.push(eq(sendLog.status, filter.status));
  if (filter.ruleId != null) conditions.push(eq(sendLog.ruleId, filter.ruleId));

  return db
    .select()
    .from(sendLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sendLog.createdAt))
    .limit(1000);
}

// Aggregate today's counts (across all rules) for the Overview page.
export interface DayCounts {
  matched: number;
  sent: number;
  failed: number;
  deduped: number;
  skippedInvalid: number;
}

export async function getDayCounts(date?: string): Promise<DayCounts> {
  const runDate = date ?? todayInRunTz();

  // sent/failed/skipped come from send_log; matched/deduped from run_summary.
  const logRows = await db
    .select({
      status: sendLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(sendLog)
    .where(eq(sendLog.runDate, runDate))
    .groupBy(sendLog.status);

  const summaryRows = await db
    .select({
      matched: sql<number>`coalesce(sum(${runSummary.matched}), 0)::int`,
      deduped: sql<number>`coalesce(sum(${runSummary.deduped}), 0)::int`,
    })
    .from(runSummary)
    .where(eq(runSummary.runDate, runDate));

  const counts: DayCounts = {
    matched: summaryRows[0]?.matched ?? 0,
    sent: 0,
    failed: 0,
    deduped: summaryRows[0]?.deduped ?? 0,
    skippedInvalid: 0,
  };

  for (const row of logRows) {
    if (row.status === "sent") counts.sent = row.count;
    else if (row.status === "failed") counts.failed = row.count;
    else if (row.status === "skipped_invalid") counts.skippedInvalid += row.count;
    else if (row.status === "skipped_dupe") counts.deduped += row.count;
  }

  return counts;
}

// All time totals across every run and every date. Used by the Overview so the
// dashboard reflects the full history, not just whatever happened today.
export async function getOverallCounts(): Promise<DayCounts> {
  const logRows = await db
    .select({
      status: sendLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(sendLog)
    .groupBy(sendLog.status);

  const summaryRows = await db
    .select({
      matched: sql<number>`coalesce(sum(${runSummary.matched}), 0)::int`,
      deduped: sql<number>`coalesce(sum(${runSummary.deduped}), 0)::int`,
    })
    .from(runSummary);

  const counts: DayCounts = {
    matched: summaryRows[0]?.matched ?? 0,
    sent: 0,
    failed: 0,
    deduped: summaryRows[0]?.deduped ?? 0,
    skippedInvalid: 0,
  };

  for (const row of logRows) {
    if (row.status === "sent") counts.sent = row.count;
    else if (row.status === "failed") counts.failed = row.count;
    else if (row.status === "skipped_invalid") counts.skippedInvalid += row.count;
    else if (row.status === "skipped_dupe") counts.deduped += row.count;
  }

  return counts;
}
