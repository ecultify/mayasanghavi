import { requireBearer, jsonOk, handle } from "@/lib/api";
import { getWabaHealth } from "@/lib/meta/client";
import { getDayCounts } from "@/lib/services/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/waba/health
export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const [health, counts] = await Promise.all([
      getWabaHealth(),
      getDayCounts(),
    ]);
    return jsonOk({
      ...health,
      sentToday: counts.sent,
      failedToday: counts.failed,
    });
  });
}
