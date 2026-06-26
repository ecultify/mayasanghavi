import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Validate the Authorization: Bearer {ADMIN_TOKEN} header. Returns null when
// authorized, or a 401 JSON response when not.
export function requireBearer(req: Request): NextResponse | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1]?.trim();

  let expected: string;
  try {
    expected = env.adminToken();
  } catch {
    return jsonError(
      "ADMIN_TOKEN is not configured on the server. Set it before using the API.",
      500,
    );
  }

  if (!provided || provided !== expected) {
    return jsonError("Unauthorized. Provide a valid Bearer ADMIN_TOKEN.", 401);
  }
  return null;
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(message: string, status = 400, extra?: unknown): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ? { detail: extra } : {}) },
    { status },
  );
}

// Wrap a handler so thrown errors become clean JSON instead of HTML stack traces.
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(message, 500);
  }
}
