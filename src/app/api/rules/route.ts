import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import { listRules, createRule, ruleInputSchema } from "@/lib/services/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => jsonOk(await listRules()));
}

export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = ruleInputSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid rule payload", 422, parsed.error.flatten());
    }
    const created = await createRule(parsed.data);
    return jsonOk(created, 201);
  });
}
