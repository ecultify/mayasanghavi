import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import { updateRule, deleteRule, rulePatchSchema } from "@/lib/services/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(idStr: string): number | null {
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id == null) return jsonError("Invalid rule id", 400);

    const body = await req.json().catch(() => ({}));
    const parsed = rulePatchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid rule patch", 422, parsed.error.flatten());
    }
    const updated = await updateRule(id, parsed.data);
    if (!updated) return jsonError("Rule not found", 404);
    return jsonOk(updated);
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (id == null) return jsonError("Invalid rule id", 400);
    const ok = await deleteRule(id);
    if (!ok) return jsonError("Rule not found", 404);
    return jsonOk({ id, deleted: true });
  });
}
