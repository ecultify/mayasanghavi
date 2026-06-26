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
    cache: "no-store",
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
    cache: "no-store",
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

// Build the year-independent recurring date match. Zoho COQL exposes day() and
// month() functions over date fields, so we match month and day against the
// target date regardless of year (a birthday/anniversary recurs annually).
function buildDateMatchQuery(
  module: ZohoModule,
  dateField: ZohoDateField,
  month: number,
  day: number,
  extraCriteria?: string | null,
): string {
  // Zoho COQL requires at least one always-true-ish base predicate; the date
  // field is guaranteed non-null for a match because day()/month() need a value.
  let where = `(day(${dateField}) = ${day} and month(${dateField}) = ${month})`;
  if (extraCriteria && extraCriteria.trim() !== "") {
    where = `(${where} and (${extraCriteria.trim()}))`;
  }
  return `select ${SELECT_FIELDS} from ${module} where ${where} limit 2000`;
}

// Query a single module for records whose date_field matches the target month/day.
export async function queryByMonthDay(
  module: ZohoModule,
  dateField: ZohoDateField,
  month: number,
  day: number,
  extraCriteria?: string | null,
): Promise<ZohoRecord[]> {
  const query = buildDateMatchQuery(module, dateField, month, day, extraCriteria);
  const rows = await coqlQuery(query);
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    First_Name: (r.First_Name as string) ?? null,
    Last_Name: (r.Last_Name as string) ?? null,
    Mobile: (r.Mobile as string) ?? null,
    Email: (r.Email as string) ?? null,
    Date_of_Birth: (r.Date_of_Birth as string) ?? null,
    Anniversary_Date: (r.Anniversary_Date as string) ?? null,
    __module: module,
  }));
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
