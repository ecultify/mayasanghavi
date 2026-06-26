import { env, ZOHO_API_BASE, ZOHO_ACCOUNTS_BASE } from "@/lib/env";

// ==== In-memory access token cache ====
// Zoho access tokens live ~1 hour. Cache for 55 minutes and refresh on demand
// or on a 401. Cached on globalThis so dev hot-reload reuses it.
type TokenCache = { token: string; expiresAt: number };
const globalForZoho = globalThis as unknown as {
  __zohoToken?: TokenCache;
};

const TOKEN_TTL_MS = 55 * 60 * 1000;

async function mintAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.zohoClientId(),
    client_secret: env.zohoClientSecret(),
    refresh_token: env.zohoRefreshToken(),
  });

  const res = await fetch(`${ZOHO_ACCOUNTS_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Zoho token refresh failed (${res.status}): ${data.error ?? "unknown error"}`,
    );
  }

  const cache: TokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  globalForZoho.__zohoToken = cache;
  return cache.token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const cached = globalForZoho.__zohoToken;
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }
  return mintAccessToken();
}

// ==== Authenticated Zoho fetch with one auto-refresh on 401 ====
async function zohoFetch(
  path: string,
  init: RequestInit,
  retried = false,
): Promise<Response> {
  const token = await getAccessToken(retried);
  const res = await fetch(`${ZOHO_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });

  if (res.status === 401 && !retried) {
    // Token may have been revoked early; force a fresh mint and retry once.
    return zohoFetch(path, init, true);
  }
  return res;
}

// ==== COQL types ====
export type ZohoModule = "Contacts" | "Leads";
export type ZohoDateField = "Date_of_Birth" | "Anniversary_Date";

export interface ZohoRecord {
  id: string;
  First_Name: string | null;
  Last_Name: string | null;
  Mobile: string | null;
  Email: string | null;
  Date_of_Birth: string | null;
  Anniversary_Date: string | null;
  // Module is not returned by COQL; we annotate it ourselves.
  __module: ZohoModule;
}

interface CoqlResponse {
  data?: Array<Record<string, unknown>>;
  info?: {
    more_records?: boolean;
    next_page_token?: string | null;
  };
}

const SELECT_FIELDS =
  "First_Name, Last_Name, Mobile, Email, Date_of_Birth, Anniversary_Date";

// Run a raw COQL query, transparently handling page_token pagination beyond the
// 2000-row per-response limit. Returns all rows.
export async function coqlQuery(
  selectQuery: string,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let pageToken: string | null = null;

  // COQL paginates with LIMIT offset normally, but the documented way past the
  // 2000-row hard cap is page_token returned in info.next_page_token.
  do {
    const body: Record<string, unknown> = { select_query: selectQuery };
    if (pageToken) body.page_token = pageToken;

    const res = await zohoFetch("/crm/v8/coql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // 204 = no records matched.
    if (res.status === 204) break;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho COQL failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as CoqlResponse;
    if (data.data?.length) rows.push(...data.data);

    pageToken = data.info?.more_records ? (data.info.next_page_token ?? null) : null;
  } while (pageToken);

  return rows;
}

// Run a single COQL page and surface the cursor pagination info, so callers can
// implement "load more" style cursor pagination (one page per request).
export async function coqlQueryPage(
  selectQuery: string,
  pageToken?: string | null,
): Promise<{
  rows: Array<Record<string, unknown>>;
  moreRecords: boolean;
  nextPageToken: string | null;
}> {
  const body: Record<string, unknown> = { select_query: selectQuery };
  if (pageToken) body.page_token = pageToken;

  const res = await zohoFetch("/crm/v8/coql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // 204 = no records.
  if (res.status === 204) {
    return { rows: [], moreRecords: false, nextPageToken: null };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho COQL failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as CoqlResponse;
  return {
    rows: data.data ?? [],
    moreRecords: data.info?.more_records ?? false,
    nextPageToken: data.info?.next_page_token ?? null,
  };
}

// Build the candidate query. Zoho COQL does NOT support DAY, MONTH, or EXTRACT
// functions (they fail with INVALID_QUERY), so we only filter to records whose
// raw date field is set, then match the month and day in TypeScript below.
// Only the raw fields Date_of_Birth and Anniversary_Date are used, never the
// unreliable formula fields (Birth_date, anniversary_dates, husband_birthday),
// which rewrite the year to a hardcoded 2025, are often null, and do not exist
// on the Leads module.
function buildCandidateQuery(
  module: ZohoModule,
  dateField: ZohoDateField,
  extraCriteria?: string | null,
): string {
  let where = `${dateField} is not null`;
  if (extraCriteria && extraCriteria.trim() !== "") {
    where = `(${where}) and (${extraCriteria.trim()})`;
  }
  return `select First_Name, Last_Name, Mobile, ${dateField} from ${module} where ${where} limit 2000`;
}

// Compare a Zoho date value (YYYY-MM-DD, for example 1994-06-29) against the
// target month and day, ignoring the year entirely. A birthday or anniversary
// recurs annually, so only the month (index 1) and day (index 2) matter.
function matchesMonthDay(
  value: string | null | undefined,
  month: number,
  day: number,
): boolean {
  if (!value) return false;
  const parts = String(value).split("-");
  if (parts.length < 3) return false;
  return Number(parts[1]) === month && Number(parts[2]) === day;
}

// Query a single module for records whose date_field matches the target month
// and day. COQL pulls every record with the date set (paginated past the
// 2000-row limit), then the month/day match happens in TypeScript.
export async function queryByMonthDay(
  module: ZohoModule,
  dateField: ZohoDateField,
  month: number,
  day: number,
  extraCriteria?: string | null,
): Promise<ZohoRecord[]> {
  const query = buildCandidateQuery(module, dateField, extraCriteria);
  const rows = await coqlQuery(query);
  const matched: ZohoRecord[] = [];
  for (const r of rows) {
    const dateValue = (r[dateField] as string) ?? null;
    if (!matchesMonthDay(dateValue, month, day)) continue;
    matched.push({
      id: String(r.id ?? ""),
      First_Name: (r.First_Name as string) ?? null,
      Last_Name: (r.Last_Name as string) ?? null,
      Mobile: (r.Mobile as string) ?? null,
      Email: null,
      Date_of_Birth: dateField === "Date_of_Birth" ? dateValue : null,
      Anniversary_Date: dateField === "Anniversary_Date" ? dateValue : null,
      __module: module,
    });
  }
  return matched;
}

// ==== Leads viewer ====
export interface LeadRow {
  id: string;
  First_Name: string | null;
  Last_Name: string | null;
  Mobile: string | null;
  Email: string | null;
  Date_of_Birth: string | null;
  Anniversary_Date: string | null;
}

export interface LeadsPage {
  rows: LeadRow[];
  moreRecords: boolean;
  nextPageToken: string | null;
}

// Strip characters that would break a COQL string literal.
function sanitizeSearch(term: string): string {
  return term.replace(/['"\\%]/g, " ").trim();
}

// Fetch one page of Leads ordered by Last_Name (100 per page), with cursor
// pagination and an optional search across name, mobile, and email. Reuses the
// shared auth and COQL helpers (no duplicated token logic).
export async function listLeadsPage(
  pageToken?: string | null,
  search?: string | null,
): Promise<LeadsPage> {
  const term = search ? sanitizeSearch(search) : "";
  // COQL needs a WHERE clause; id is always present, so the default returns all.
  // Zoho COQL allows at most two conditions per parenthesis group, so the four
  // search fields must be nested in pairs rather than flat (A or B or C or D).
  const where = term
    ? `((First_Name like '%${term}%' or Last_Name like '%${term}%') or (Mobile like '%${term}%' or Email like '%${term}%'))`
    : "id is not null";
  const query = `select ${SELECT_FIELDS} from Leads where ${where} order by Last_Name limit 100`;
  const { rows, moreRecords, nextPageToken } = await coqlQueryPage(
    query,
    pageToken,
  );
  return {
    rows: rows.map((r) => ({
      id: String(r.id ?? ""),
      First_Name: (r.First_Name as string) ?? null,
      Last_Name: (r.Last_Name as string) ?? null,
      Mobile: (r.Mobile as string) ?? null,
      Email: (r.Email as string) ?? null,
      Date_of_Birth: (r.Date_of_Birth as string) ?? null,
      Anniversary_Date: (r.Anniversary_Date as string) ?? null,
    })),
    moreRecords,
    nextPageToken,
  };
}

export interface CreateLeadInput {
  First_Name?: string | null;
  Last_Name: string; // required by Zoho
  Mobile?: string | null;
  Email?: string | null;
  Date_of_Birth?: string | null; // YYYY-MM-DD
  Anniversary_Date?: string | null; // YYYY-MM-DD
  tag?: string | null;
}

// Create a Lead, then apply a tag via the Zoho add_tags action (tags are a
// separate API from record fields). Returns the new record id and applied tag.
export async function createLead(
  input: CreateLeadInput,
): Promise<{ id: string; tag: string | null }> {
  const record: Record<string, unknown> = { Last_Name: input.Last_Name };
  if (input.First_Name) record.First_Name = input.First_Name;
  if (input.Mobile) record.Mobile = input.Mobile;
  if (input.Email) record.Email = input.Email;
  if (input.Date_of_Birth) record.Date_of_Birth = input.Date_of_Birth;
  if (input.Anniversary_Date) record.Anniversary_Date = input.Anniversary_Date;

  const res = await zohoFetch("/crm/v8/Leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [record] }),
  });
  const data = (await res.json()) as {
    data?: Array<{
      code?: string;
      status?: string;
      message?: string;
      details?: { id?: string };
    }>;
  };
  const first = data.data?.[0];
  if (!res.ok || first?.status !== "success" || !first.details?.id) {
    throw new Error(
      `Zoho create lead failed: ${first?.message ?? `HTTP ${res.status}`}`,
    );
  }
  const id = first.details.id;

  // Apply the tag (best effort). A tag failure should not undo the created lead.
  // Zoho's add_tags action is module level (ids + tag_names) and also requires a
  // JSON body, so we send both.
  let appliedTag: string | null = null;
  const tag = input.tag?.trim();
  if (tag) {
    const params = new URLSearchParams({
      ids: id,
      tag_names: tag,
      over_write: "false",
    });
    const tagRes = await zohoFetch(
      `/crm/v8/Leads/actions/add_tags?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [{ name: tag }] }),
      },
    );
    if (tagRes.ok) appliedTag = tag;
  }

  return { id, tag: appliedTag };
}

// Query one or both modules (Contacts, Leads, or both) for a month/day match.
export async function queryRecipients(
  module: "Contacts" | "Leads" | "both",
  dateField: ZohoDateField,
  month: number,
  day: number,
  extraCriteria?: string | null,
): Promise<ZohoRecord[]> {
  const modules: ZohoModule[] =
    module === "both" ? ["Contacts", "Leads"] : [module];
  const results = await Promise.all(
    modules.map((m) =>
      queryByMonthDay(m, dateField, month, day, extraCriteria),
    ),
  );
  return results.flat();
}

// Lightweight connectivity check used by the dashboard/health endpoint.
export async function zohoHealthCheck(): Promise<{ ok: boolean; detail: string }> {
  try {
    await getAccessToken();
    return { ok: true, detail: "Token minted" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
