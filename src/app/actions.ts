"use server";

import { revalidatePath } from "next/cache";
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  ruleInputSchema,
  rulePatchSchema,
} from "@/lib/services/rules";
import { listLogs, type LogFilter } from "@/lib/services/logs";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
  uploadSampleMedia,
} from "@/lib/meta/client";
import type { CreateTemplateInput } from "@/lib/meta/types";
import { sendTemplate } from "@/lib/meta/client";
import { normalizeMobile } from "@/lib/phone";
import { runWorker } from "@/lib/worker";
import { db } from "@/lib/db";
import { sendLog } from "@/lib/db/schema";
import { todayInRunTz } from "@/lib/time";
import { explainMetaError } from "@/lib/meta/errors";

// Dashboard server actions run on the server, so they never expose ADMIN_TOKEN
// to the browser. The bearer-authed /api/* routes mirror these for terminal use.

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ================ Rules ================

export async function createRuleAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = ruleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid rule" };
  }
  try {
    const rule = await createRule(parsed.data);
    revalidatePath("/rules");
    return { ok: true, data: rule };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateRuleAction(
  id: number,
  patch: unknown,
): Promise<ActionResult> {
  const parsed = rulePatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid patch" };
  }
  try {
    const rule = await updateRule(id, parsed.data);
    if (!rule) return { ok: false, error: "Rule not found" };
    revalidatePath("/rules");
    return { ok: true, data: rule };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteRuleAction(id: number): Promise<ActionResult> {
  try {
    const ok = await deleteRule(id);
    if (!ok) return { ok: false, error: "Rule not found" };
    revalidatePath("/rules");
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listRulesAction(): Promise<ActionResult> {
  try {
    return { ok: true, data: await listRules() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ================ Run ================

export async function runNowAction(opts: {
  ruleId?: number;
  date?: string;
  dryRun?: boolean;
}): Promise<ActionResult> {
  try {
    const result = await runWorker(opts);
    revalidatePath("/");
    revalidatePath("/logs");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ================ Logs ================

export async function fetchLogsAction(filter: LogFilter): Promise<ActionResult> {
  try {
    const rows = await listLogs(filter);
    const annotated = rows.map((r) => ({
      ...r,
      errorExplanation: r.errorCode ? explainMetaError(r.errorCode) : null,
    }));
    return { ok: true, data: annotated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ================ Templates ================

export async function fetchTemplatesAction(): Promise<ActionResult> {
  try {
    return { ok: true, data: await listTemplates() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createTemplateAction(
  input: CreateTemplateInput,
): Promise<ActionResult> {
  try {
    const result = await createTemplate(input);
    if (!result.ok) {
      return {
        ok: false,
        error: `${result.errorDetail ?? "Meta rejected the template"}${
          result.errorCode ? ` (code ${result.errorCode})` : ""
        }`,
      };
    }
    revalidatePath("/templates");
    revalidatePath("/rules");
    return { ok: true, data: { status: result.status, id: result.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteTemplateAction(name: string): Promise<ActionResult> {
  try {
    const result = await deleteTemplate(name);
    if (!result.ok) {
      return { ok: false, error: result.errorDetail ?? "Delete failed" };
    }
    revalidatePath("/templates");
    return { ok: true, data: { name } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Upload a sample image (FormData with field "file") and return the media handle.
export async function uploadMediaAction(
  formData: FormData,
): Promise<ActionResult<{ handle: string }>> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file provided" };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "Only image files are supported" };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Image exceeds the 5 MB limit" };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadSampleMedia(bytes, file.name, file.type);
    if (!result.ok || !result.handle) {
      return { ok: false, error: result.errorDetail ?? "Upload failed" };
    }
    return { ok: true, data: { handle: result.handle } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ================ Manual test send ================

export async function sendTestAction(input: {
  to: string;
  template: string;
  lang?: string;
  name?: string;
  headerImageUrl?: string;
}): Promise<ActionResult> {
  const mobile = normalizeMobile(input.to);
  if (!mobile) {
    return {
      ok: false,
      error: `"${input.to}" is not a valid Indian mobile (10 digits or 91XXXXXXXXXX).`,
    };
  }
  try {
    const result = await sendTemplate({
      to: mobile,
      templateName: input.template,
      language: input.lang ?? "en_US",
      name: input.name || null,
      headerImageUrl: input.headerImageUrl || null,
    });

    await db
      .insert(sendLog)
      .values({
        ruleId: null,
        runDate: todayInRunTz(),
        recipientName: input.name || null,
        recipientMobile: mobile,
        templateName: input.template,
        status: result.ok ? "sent" : "failed",
        waMessageId: result.messageId,
        errorCode: result.errorCode,
        errorDetail: result.errorDetail,
      })
      .onConflictDoNothing();

    revalidatePath("/logs");

    if (!result.ok) {
      return {
        ok: false,
        error: `Send failed: ${
          result.errorDetail ?? "unknown"
        }${result.errorCode ? ` (${explainMetaError(result.errorCode)})` : ""}`,
      };
    }
    return { ok: true, data: { messageId: result.messageId, to: mobile } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
