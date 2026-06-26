import { z } from "zod";
import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
} from "@/lib/meta/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buttonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL"]),
  text: z.string().min(1).max(25),
  url: z.string().url().optional(),
});

const createSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-z0-9_]+$/,
      "Template name must be lowercase letters, numbers and underscores only",
    )
    .max(512),
  language: z.string().min(2),
  category: z.enum(["MARKETING", "UTILITY"]),
  headerType: z.enum(["NONE", "TEXT", "IMAGE"]),
  headerText: z.string().max(60).optional(),
  headerImageHandle: z.string().optional(),
  body: z.string().min(1).max(1024),
  bodyExample: z.string().optional(),
  footer: z.string().max(60).optional(),
  buttons: z.array(buttonSchema).max(10).optional(),
});

// GET /api/templates
export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => jsonOk(await listTemplates()));
}

// POST /api/templates
export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid template payload", 422, parsed.error.flatten());
    }
    const input = parsed.data;

    // Server-side guard mirroring Meta rules: a {{1}} in the body needs a sample.
    if (/\{\{\s*\d+\s*\}\}/.test(input.body) && !input.bodyExample) {
      return jsonError(
        "Body contains a {{1}} variable but no sample value was provided.",
        422,
      );
    }
    if (input.headerType === "IMAGE" && !input.headerImageHandle) {
      return jsonError(
        "Image header selected but no media handle. Upload a sample image first.",
        422,
      );
    }
    if (input.headerType === "TEXT" && !input.headerText) {
      return jsonError("Text header selected but no header text provided.", 422);
    }

    const result = await createTemplate(input);
    if (!result.ok) {
      return jsonError(
        result.errorDetail ?? "Meta rejected the template",
        400,
        { errorCode: result.errorCode },
      );
    }
    return jsonOk(
      { id: result.id, status: result.status, category: result.category },
      201,
    );
  });
}

// DELETE /api/templates?name=
export async function DELETE(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    if (!name) return jsonError("Query param 'name' is required", 400);
    const result = await deleteTemplate(name);
    if (!result.ok) {
      return jsonError(result.errorDetail ?? "Delete failed", 400, {
        errorCode: result.errorCode,
      });
    }
    return jsonOk({ name, deleted: true });
  });
}
