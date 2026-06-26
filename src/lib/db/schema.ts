import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ==== Enums ====
export const moduleEnum = pgEnum("module", ["Contacts", "Leads", "both"]);
export const dateFieldEnum = pgEnum("date_field", [
  "Date_of_Birth",
  "Anniversary_Date",
]);
export const sendStatusEnum = pgEnum("send_status", [
  "sent",
  "failed",
  "skipped_dupe",
  "skipped_invalid",
]);

// ==== rules ====
// One automation rule. Drives a daily COQL query against Zoho and a WhatsApp
// template send for each matching, deduped recipient.
export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  module: moduleEnum("module").notNull().default("both"),
  dateField: dateFieldEnum("date_field").notNull().default("Date_of_Birth"),
  templateName: text("template_name").notNull(),
  templateLang: text("template_lang").notNull().default("en_US"),
  hasNameVar: boolean("has_name_var").notNull().default(false),
  hasHeaderImage: boolean("has_header_image").notNull().default(false),
  headerImageUrl: text("header_image_url"),
  sendTime: text("send_time").notNull().default("09:00"),
  // Optional extra COQL criteria fragment (raw WHERE clause snippet) stored as JSON.
  criteriaJson: text("criteria_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ==== send_log ====
// One row per recipient per rule per run. The unique index gives idempotency:
// a recipient already sent for (rule, run_date) is never sent again.
export const sendLog = pgTable(
  "send_log",
  {
    id: serial("id").primaryKey(),
    ruleId: integer("rule_id").references(() => rules.id, {
      onDelete: "set null",
    }),
    runDate: text("run_date").notNull(), // YYYY-MM-DD in RUN_TIMEZONE
    recipientName: text("recipient_name"),
    recipientMobile: text("recipient_mobile").notNull(),
    templateName: text("template_name").notNull(),
    status: sendStatusEnum("status").notNull(),
    waMessageId: text("wa_message_id"),
    errorCode: text("error_code"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Idempotency: at most one send attempt per recipient per rule per day.
    uniqRecipientPerRun: uniqueIndex("uniq_recipient_per_run").on(
      table.ruleId,
      table.runDate,
      table.recipientMobile,
    ),
    byRunDate: index("send_log_run_date_idx").on(table.runDate),
    byStatus: index("send_log_status_idx").on(table.status),
  }),
);

// ==== run_summary ====
// One row per rule per run (plus an aggregate row when running all rules).
export const runSummary = pgTable("run_summary", {
  id: serial("id").primaryKey(),
  runDate: text("run_date").notNull(),
  ruleId: integer("rule_id").references(() => rules.id, {
    onDelete: "set null",
  }),
  matched: integer("matched").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  deduped: integer("deduped").notNull().default(0),
  skippedInvalid: integer("skipped_invalid").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ==== Inferred types ====
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type SendLog = typeof sendLog.$inferSelect;
export type NewSendLog = typeof sendLog.$inferInsert;
export type RunSummary = typeof runSummary.$inferSelect;
export type NewRunSummary = typeof runSummary.$inferInsert;
