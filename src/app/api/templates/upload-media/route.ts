import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import { uploadSampleMedia } from "@/lib/meta/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/templates/upload-media  (multipart/form-data, field "file")
// Runs the Meta Resumable Upload and returns the media handle for use in a
// template HEADER example.
export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("Expected multipart/form-data", 400);

    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("Missing 'file' field", 400);
    }
    if (!file.type.startsWith("image/")) {
      return jsonError("Only image files are supported for image headers", 400);
    }
    // Meta caps template sample images at 5 MB.
    if (file.size > 5 * 1024 * 1024) {
      return jsonError("Image exceeds the 5 MB limit", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadSampleMedia(bytes, file.name, file.type);
    if (!result.ok) {
      return jsonError(result.errorDetail ?? "Upload failed", 400);
    }
    return jsonOk({ handle: result.handle });
  });
}
