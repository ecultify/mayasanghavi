import { z } from "zod";
import { db } from "@/lib/db";
import { rules as rulesTable } from "@/lib/db/schema";
import type { Rule } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const ruleInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  enabled: z.boolean().optional(),
  module: z.enum(["Contacts", "Leads", "both"]),
  dateField: z.enum(["Date_of_Birth", "Anniversary_Date"]),
  templateName: z.string().min(1, "Template name is required"),
  templateLang: z.string().min(1).optional(),
  hasNameVar: z.boolean().optional(),
  hasHeaderImage: z.boolean().optional(),
  headerImageUrl: z.string().url().nullable().optional(),
  sendTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "send_time must be HH:MM")
    .optional(),
  criteriaJson: z.string().nullable().optional(),
});

export type RuleInput = z.infer<typeof ruleInputSchema>;

export const rulePatchSchema = ruleInputSchema.partial();
export type RulePatch = z.infer<typeof rulePatchSchema>;

export async function listRules(): Promise<Rule[]> {
  return db.select().from(rulesTable).orderBy(rulesTable.id);
}

export async function getRule(id: number): Promise<Rule | null> {
  const rows = await db.select().from(rulesTable).where(eq(rulesTable.id, id));
  return rows[0] ?? null;
}

export async function createRule(input: RuleInput): Promise<Rule> {
  const [created] = await db
    .insert(rulesTable)
    .values({
      name: input.name,
      enabled: input.enabled ?? true,
      module: input.module,
      dateField: input.dateField,
      templateName: input.templateName,
      templateLang: input.templateLang ?? "en_US",
      hasNameVar: input.hasNameVar ?? false,
      hasHeaderImage: input.hasHeaderImage ?? false,
      headerImageUrl: input.headerImageUrl ?? null,
      sendTime: input.sendTime ?? "09:00",
      criteriaJson: input.criteriaJson ?? null,
    })
    .returning();
  return created;
}

export async function updateRule(id: number, patch: RulePatch): Promise<Rule | null> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) updates[key] = value;
  }
  const [updated] = await db
    .update(rulesTable)
    .set(updates)
    .where(eq(rulesTable.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteRule(id: number): Promise<boolean> {
  const deleted = await db
    .delete(rulesTable)
    .where(eq(rulesTable.id, id))
    .returning({ id: rulesTable.id });
  return deleted.length > 0;
}
