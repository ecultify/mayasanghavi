import { z } from "zod";
import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import { sendTemplate } from "@/lib/meta/client";
import { normalizeMobile } from "@/lib/phone";
import { db } from "@/lib/db";
import { sendLog } from "@/lib/db/schema";
import { todayInRunTz } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().min(5),
  template: z.string().min(1),
  lang: z.string().min(1).optional(),
  name: z.string().optional(),
  headerImageUrl: z.string().url().optional(),
});

// POST /api/send-test  { to, template, lang?, name?, headerImageUrl? }
// Fires one template send now and records it in send_log.
export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid send-test payload", 422, parsed.error.flatten());
    }
    const { to, template, lang, name, headerImageUrl } = parsed.data;

    const mobile = normalizeMobile(to);
    if (!mobile) {
      return jsonError(
        `Number "${to}" is not a valid Indian mobile (expected 10 digits or 91XXXXXXXXXX).`,
        400,
      );
    }

    const result = await sendTemplate({
      to: mobile,
      templateName: template,
      language: lang ?? "en_US",
      name: name ?? null,
      headerImageUrl: headerImageUrl ?? null,
    });

    // Record the manual test in the log (rule_id null = ad-hoc test).
    await db
      .insert(sendLog)
      .values({
        ruleId: null,
        runDate: todayInRunTz(),
        recipientName: name ?? null,
        recipientMobile: mobile,
        templateName: template,
        status: result.ok ? "sent" : "failed",
        waMessageId: result.messageId,
        errorCode: result.errorCode,
        errorDetail: result.errorDetail,
      })
      .onConflictDoNothing();

    return jsonOk({
      sent: result.ok,
      to: mobile,
      messageId: result.messageId,
      errorCode: result.errorCode,
      errorDetail: result.errorDetail,
    });
  });
}
