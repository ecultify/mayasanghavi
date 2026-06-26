import { requireBearer, jsonOk, handle } from "@/lib/api";
import { listLeadsPage } from "@/lib/zoho/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leads?page_token=
// Returns one page of Zoho Leads (200 rows, ordered by Last_Name) plus the
// cursor for the next page (more_records and next page_token).
export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const url = new URL(req.url);
    const pageToken = url.searchParams.get("page_token");
    const page = await listLeadsPage(pageToken);
    return jsonOk({
      rows: page.rows,
      moreRecords: page.moreRecords,
      pageToken: page.nextPageToken,
    });
  });
}
