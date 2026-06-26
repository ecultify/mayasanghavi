import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import { runWorker } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow longer execution for a full daily run across many recipients.
export const maxDuration = 300;

// POST /api/run?rule_id=&date=&dry_run=
// Omit rule_id to run every enabled rule. This is also the Railway cron target.
export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const url = new URL(req.url);
    const ruleIdParam = url.searchParams.get("rule_id");
    const dateParam = url.searchParams.get("date");
    const dryRunParam = url.searchParams.get("dry_run");

    let ruleId: number | undefined;
    if (ruleIdParam) {
      const n = Number(ruleIdParam);
      if (!Number.isInteger(n) || n <= 0) {
        return jsonError("Invalid rule_id", 400);
      }
      ruleId = n;
    }

    const dryRun = dryRunParam === "true" || dryRunParam === "1";

    const result = await runWorker({
      ruleId,
      date: dateParam ?? undefined,
      dryRun,
    });
    return jsonOk(result);
  });
}
