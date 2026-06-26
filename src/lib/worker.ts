import { db } from "@/lib/db";
import { rules as rulesTable, sendLog, runSummary } from "@/lib/db/schema";
import type { Rule } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { queryRecipients, type ZohoRecord } from "@/lib/zoho/client";
import { sendTemplate } from "@/lib/meta/client";
import { normalizeMobile } from "@/lib/phone";
import { todayInRunTz, parseRunDate } from "@/lib/time";

export interface ComputedRecipient {
  name: string;
  firstName: string;
  mobile: string; // normalized E.164 digits
  module: "Contacts" | "Leads";
  rawMobile: string | null;
}

export interface RuleRunResult {
  ruleId: number;
  ruleName: string;
  runDate: string;
  matched: number;
  sent: number;
  failed: number;
  deduped: number;
  skippedInvalid: number;
  durationMs: number;
  dryRun: boolean;
  recipients: ComputedRecipient[]; // populated for dry runs
}

function fullName(r: ZohoRecord): string {
  return [r.First_Name, r.Last_Name].filter(Boolean).join(" ").trim();
}

// Build the deduped, validated recipient list for a rule on a given date.
// Returns the valid recipients plus counts of what was skipped.
async function computeRecipients(
  rule: Rule,
  month: number,
  day: number,
): Promise<{
  recipients: ComputedRecipient[];
  matched: number;
  deduped: number;
  skippedInvalid: number;
  invalidRecords: ZohoRecord[];
}> {
  const records = await queryRecipients(
    rule.module,
    rule.dateField,
    month,
    day,
    rule.criteriaJson,
  );

  const matched = records.length;
  const seen = new Set<string>();
  const recipients: ComputedRecipient[] = [];
  const invalidRecords: ZohoRecord[] = [];
  let deduped = 0;
  let skippedInvalid = 0;

  for (const r of records) {
    const mobile = normalizeMobile(r.Mobile);
    if (!mobile) {
      skippedInvalid += 1;
      invalidRecords.push(r);
      continue;
    }
    if (seen.has(mobile)) {
      deduped += 1;
      continue;
    }
    seen.add(mobile);
    recipients.push({
      name: fullName(r) || "there",
      firstName: (r.First_Name ?? "there").trim() || "there",
      mobile,
      module: r.__module,
      rawMobile: r.Mobile,
    });
  }

  return { recipients, matched, deduped, skippedInvalid, invalidRecords };
}

// Has this recipient already been sent (status sent) for this rule + run_date?
async function alreadySent(
  ruleId: number,
  runDate: string,
  mobile: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: sendLog.id, status: sendLog.status })
    .from(sendLog)
    .where(
      and(
        eq(sendLog.ruleId, ruleId),
        eq(sendLog.runDate, runDate),
        eq(sendLog.recipientMobile, mobile),
      ),
    )
    .limit(1);
  // Idempotency: skip if a successful send row already exists.
  return existing.some((e) => e.status === "sent");
}

// Run a single rule. dryRun computes recipients and sends nothing.
export async function runRule(
  rule: Rule,
  runDate: string,
  dryRun: boolean,
): Promise<RuleRunResult> {
  const startedAt = Date.now();
  const { month, day } = parseRunDate(runDate);

  const { recipients, matched, deduped, skippedInvalid, invalidRecords } =
    await computeRecipients(rule, month, day);

  let sent = 0;
  let failed = 0;

  if (dryRun) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      runDate,
      matched,
      sent: 0,
      failed: 0,
      deduped,
      skippedInvalid,
      durationMs: Date.now() - startedAt,
      dryRun: true,
      recipients,
    };
  }

  // Log invalid records for visibility (best-effort, ignore unique conflicts).
  for (const r of invalidRecords) {
    await db
      .insert(sendLog)
      .values({
        ruleId: rule.id,
        runDate,
        recipientName: fullName(r) || null,
        recipientMobile: r.Mobile ?? "unknown",
        templateName: rule.templateName,
        status: "skipped_invalid",
        errorDetail: "Mobile failed E.164 normalization",
      })
      .onConflictDoNothing();
  }

  for (const rec of recipients) {
    // Idempotency guard before sending.
    if (await alreadySent(rule.id, runDate, rec.mobile)) {
      continue;
    }

    const result = await sendTemplate({
      to: rec.mobile,
      templateName: rule.templateName,
      language: rule.templateLang,
      name: rule.hasNameVar ? rec.firstName : null,
      headerImageUrl: rule.hasHeaderImage ? rule.headerImageUrl : null,
    });

    if (result.ok) sent += 1;
    else failed += 1;

    // Upsert the send_log row. The unique index makes re-runs idempotent.
    await db
      .insert(sendLog)
      .values({
        ruleId: rule.id,
        runDate,
        recipientName: rec.name,
        recipientMobile: rec.mobile,
        templateName: rule.templateName,
        status: result.ok ? "sent" : "failed",
        waMessageId: result.messageId,
        errorCode: result.errorCode,
        errorDetail: result.errorDetail,
      })
      .onConflictDoUpdate({
        target: [sendLog.ruleId, sendLog.runDate, sendLog.recipientMobile],
        set: {
          status: result.ok ? "sent" : "failed",
          waMessageId: result.messageId,
          errorCode: result.errorCode,
          errorDetail: result.errorDetail,
          recipientName: rec.name,
          templateName: rule.templateName,
        },
      });
  }

  const durationMs = Date.now() - startedAt;

  await db.insert(runSummary).values({
    runDate,
    ruleId: rule.id,
    matched,
    sent,
    failed,
    deduped,
    skippedInvalid,
    durationMs,
  });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    runDate,
    matched,
    sent,
    failed,
    deduped,
    skippedInvalid,
    durationMs,
    dryRun: false,
    recipients,
  };
}

// Run one rule by id, or every enabled rule when ruleId is omitted.
export async function runWorker(opts: {
  ruleId?: number;
  date?: string;
  dryRun?: boolean;
}): Promise<{ runDate: string; dryRun: boolean; results: RuleRunResult[] }> {
  const runDate = opts.date ?? todayInRunTz();
  const dryRun = opts.dryRun ?? false;

  let targetRules: Rule[];
  if (opts.ruleId != null) {
    targetRules = await db
      .select()
      .from(rulesTable)
      .where(eq(rulesTable.id, opts.ruleId));
    if (targetRules.length === 0) {
      throw new Error(`Rule ${opts.ruleId} not found.`);
    }
  } else {
    targetRules = await db
      .select()
      .from(rulesTable)
      .where(eq(rulesTable.enabled, true));
  }

  const results: RuleRunResult[] = [];
  for (const rule of targetRules) {
    // When running all rules, honor the enabled flag (single-rule runs are explicit).
    if (opts.ruleId == null && !rule.enabled) continue;
    results.push(await runRule(rule, runDate, dryRun));
  }

  return { runDate, dryRun, results };
}
