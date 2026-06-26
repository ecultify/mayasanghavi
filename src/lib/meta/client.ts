import { env, GRAPH_BASE } from "@/lib/env";
import type {
  MetaTemplate,
  NormalizedTemplate,
  TemplateComponent,
  HeaderType,
  TemplateButton,
  WabaHealth,
  SendResult,
  CreateTemplateInput,
} from "./types";

// ==== Low-level Graph fetch ====
async function graphFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.waToken()}`,
      ...(init.headers ?? {}),
    },
    // Next 15 leaves fetch uncached by default; the cache layer (src/lib/cache.ts)
    // memoizes results for views, while the worker reads live.
  });
}

interface GraphError {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
  };
}

function extractError(payload: GraphError): {
  code: string | null;
  detail: string | null;
} {
  const e = payload.error;
  if (!e) return { code: null, detail: null };
  const detail = e.error_data?.details ?? e.message ?? null;
  return { code: e.code != null ? String(e.code) : null, detail };
}

// =============================================================================
// Sending
// =============================================================================

// Send an approved template. Optionally inserts a body name parameter (for the
// {{1}} first-name variable) and/or a header image parameter.
export async function sendTemplate(opts: {
  to: string;
  templateName: string;
  language: string;
  name?: string | null;
  headerImageUrl?: string | null;
}): Promise<SendResult> {
  const components: Array<Record<string, unknown>> = [];

  if (opts.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: opts.headerImageUrl } }],
    });
  }
  if (opts.name) {
    components.push({
      type: "body",
      parameters: [{ type: "text", text: opts.name }],
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: opts.templateName,
      language: { code: opts.language },
      ...(components.length ? { components } : {}),
    },
  };

  const res = await graphFetch(`/${env.waPhoneNumberId()}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as
    | { messages?: Array<{ id: string }> }
    | GraphError;

  if (!res.ok) {
    const { code, detail } = extractError(payload as GraphError);
    return { ok: false, messageId: null, errorCode: code, errorDetail: detail };
  }

  const messageId =
    (payload as { messages?: Array<{ id: string }> }).messages?.[0]?.id ?? null;
  return { ok: true, messageId, errorCode: null, errorDetail: null };
}

// =============================================================================
// Template management
// =============================================================================

// Detect a name/body variable and image header from raw components.
export function normalizeTemplate(t: MetaTemplate): NormalizedTemplate {
  let hasNameVar = false;
  let hasHeaderImage = false;
  let headerType: HeaderType = "NONE";
  let bodyText = "";
  let footerText: string | null = null;
  const buttons: TemplateButton[] = [];

  for (const c of t.components ?? []) {
    if (c.type === "BODY") {
      bodyText = c.text ?? "";
      // A {{n}} placeholder in the body means it expects a parameter.
      if (/\{\{\s*\d+\s*\}\}/.test(bodyText)) hasNameVar = true;
    } else if (c.type === "HEADER") {
      if (c.format === "IMAGE") {
        hasHeaderImage = true;
        headerType = "IMAGE";
      } else if (c.format === "TEXT") {
        headerType = "TEXT";
      }
    } else if (c.type === "FOOTER") {
      footerText = c.text ?? null;
    } else if (c.type === "BUTTONS") {
      for (const b of c.buttons ?? []) {
        buttons.push({
          type: b.type === "URL" ? "URL" : "QUICK_REPLY",
          text: b.text,
          url: b.url,
        });
      }
    }
  }

  return {
    id: t.id,
    name: t.name,
    status: t.status,
    category: t.category,
    language: t.language,
    hasNameVar,
    hasHeaderImage,
    headerType,
    bodyText,
    footerText,
    buttons,
    rejectedReason: t.rejected_reason ?? null,
    qualityScore: t.quality_score?.score ?? null,
  };
}

// List all templates on the WABA. Handles Graph cursor pagination.
export async function listTemplates(): Promise<NormalizedTemplate[]> {
  const all: MetaTemplate[] = [];
  let after: string | null = null;

  do {
    const params = new URLSearchParams({
      fields:
        "name,status,language,category,components,rejected_reason,quality_score",
      limit: "100",
    });
    if (after) params.set("after", after);

    const res = await graphFetch(
      `/${env.waWabaId()}/message_templates?${params.toString()}`,
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meta list templates failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as {
      data?: MetaTemplate[];
      paging?: { cursors?: { after?: string }; next?: string };
    };
    if (data.data?.length) all.push(...data.data);
    after = data.paging?.next ? (data.paging.cursors?.after ?? null) : null;
  } while (after);

  return all.map(normalizeTemplate);
}

// Build the components array for a create-template request.
function buildCreateComponents(input: CreateTemplateInput): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  // Header
  if (input.headerType === "TEXT" && input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  } else if (input.headerType === "IMAGE" && input.headerImageHandle) {
    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: [input.headerImageHandle] },
    });
  }

  // Body (with example when a variable is present)
  const bodyComponent: TemplateComponent = { type: "BODY", text: input.body };
  if (/\{\{\s*\d+\s*\}\}/.test(input.body) && input.bodyExample) {
    bodyComponent.example = { body_text: [[input.bodyExample]] };
  }
  components.push(bodyComponent);

  // Footer
  if (input.footer) {
    components.push({ type: "FOOTER", text: input.footer });
  }

  // Buttons
  if (input.buttons && input.buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text, url: b.url }
          : { type: "QUICK_REPLY", text: b.text },
      ),
    });
  }

  return components;
}

export async function createTemplate(input: CreateTemplateInput): Promise<{
  ok: boolean;
  id: string | null;
  status: string | null;
  category: string | null;
  errorCode: string | null;
  errorDetail: string | null;
}> {
  const body = {
    name: input.name,
    language: input.language,
    category: input.category,
    components: buildCreateComponents(input),
  };

  const res = await graphFetch(`/${env.waWabaId()}/message_templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json()) as
    | { id?: string; status?: string; category?: string }
    | GraphError;

  if (!res.ok) {
    const { code, detail } = extractError(payload as GraphError);
    return {
      ok: false,
      id: null,
      status: null,
      category: null,
      errorCode: code,
      errorDetail: detail,
    };
  }

  const ok = payload as { id?: string; status?: string; category?: string };
  return {
    ok: true,
    id: ok.id ?? null,
    status: ok.status ?? null,
    category: ok.category ?? null,
    errorCode: null,
    errorDetail: null,
  };
}

export async function deleteTemplate(name: string): Promise<{
  ok: boolean;
  errorCode: string | null;
  errorDetail: string | null;
}> {
  const params = new URLSearchParams({ name });
  const res = await graphFetch(
    `/${env.waWabaId()}/message_templates?${params.toString()}`,
    { method: "DELETE" },
  );
  const payload = (await res.json()) as { success?: boolean } | GraphError;
  if (!res.ok) {
    const { code, detail } = extractError(payload as GraphError);
    return { ok: false, errorCode: code, errorDetail: detail };
  }
  return { ok: true, errorCode: null, errorDetail: null };
}

// =============================================================================
// Resumable Upload API (for image-header template samples)
// =============================================================================

// Two-step flow: (1) start an upload session against the app, (2) POST the file
// bytes to the session with `Authorization: OAuth {token}` to receive a handle.
export async function uploadSampleMedia(
  bytes: ArrayBuffer | Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ ok: boolean; handle: string | null; errorDetail: string | null }> {
  const fileLength = bytes instanceof Buffer ? bytes.length : bytes.byteLength;

  // Step 1: start session.
  const startParams = new URLSearchParams({
    file_name: fileName,
    file_length: String(fileLength),
    file_type: mimeType,
  });
  const startRes = await graphFetch(
    `/${env.waAppId()}/uploads?${startParams.toString()}`,
    { method: "POST" },
  );
  const startPayload = (await startRes.json()) as
    | { id?: string }
    | GraphError;
  if (!startRes.ok || !(startPayload as { id?: string }).id) {
    const { detail } = extractError(startPayload as GraphError);
    return { ok: false, handle: null, errorDetail: detail ?? "Failed to start upload session" };
  }
  const sessionId = (startPayload as { id: string }).id;

  // Step 2: upload bytes. Note the OAuth (not Bearer) scheme required here.
  const uploadRes = await fetch(`${GRAPH_BASE}/${sessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${env.waToken()}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: bytes instanceof Buffer ? new Uint8Array(bytes) : new Uint8Array(bytes),
  });
  const uploadPayload = (await uploadRes.json()) as
    | { h?: string }
    | GraphError;
  if (!uploadRes.ok || !(uploadPayload as { h?: string }).h) {
    const { detail } = extractError(uploadPayload as GraphError);
    return { ok: false, handle: null, errorDetail: detail ?? "Failed to upload media bytes" };
  }
  return { ok: true, handle: (uploadPayload as { h: string }).h, errorDetail: null };
}

// =============================================================================
// Health
// =============================================================================

export async function getWabaHealth(): Promise<WabaHealth> {
  const params = new URLSearchParams({
    fields:
      "verified_name,display_phone_number,quality_rating,messaging_limit_tier,code_verification_status",
  });
  const res = await graphFetch(
    `/${env.waPhoneNumberId()}?${params.toString()}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta health check failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    quality_rating?: string;
    messaging_limit_tier?: string;
    verified_name?: string;
    display_phone_number?: string;
    code_verification_status?: string;
  };
  return {
    qualityRating: data.quality_rating ?? null,
    messagingLimitTier: data.messaging_limit_tier ?? null,
    verifiedName: data.verified_name ?? null,
    displayPhoneNumber: data.display_phone_number ?? null,
    codeVerificationStatus: data.code_verification_status ?? null,
  };
}
