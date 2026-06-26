import { requireBearer, jsonOk, handle } from "@/lib/api";
import { listLogs } from "@/lib/services/logs";
import { explainMetaError } from "@/lib/meta/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/logs?date=&status=&rule_id=
export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? undefined;
    const status = url.searchParams.get("status") as
      | "sent"
      | "failed"
      | "skipped_dupe"
      | "skipped_invalid"
      | null;
    const ruleIdParam = url.searchParams.get("rule_id");
    const ruleId = ruleIdParam ? Number(ruleIdParam) : undefined;

    const rows = await listLogs({
      date,
      status: status ?? undefined,
      ruleId: ruleId && Number.isInteger(ruleId) ? ruleId : undefined,
    });

    // Annotate failures with a human-readable explanation of the Meta code.
    const annotated = rows.map((r) => ({
      ...r,
      errorExplanation: r.errorCode ? explainMetaError(r.errorCode) : null,
    }));

    return jsonOk(annotated);
  });
}
