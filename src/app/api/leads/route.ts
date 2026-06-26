import { z } from "zod";
import { requireBearer, jsonOk, jsonError, handle } from "@/lib/api";
import { listLeadsPage, createLead } from "@/lib/zoho/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leads?page_token=&q=
// Returns one page of Zoho Leads (100 rows, ordered by Last_Name) plus the
// cursor for the next page. Optional q searches name, mobile, and email.
export async function GET(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const url = new URL(req.url);
    const pageToken = url.searchParams.get("page_token");
    const q = url.searchParams.get("q");
    const page = await listLeadsPage(pageToken, q);
    return jsonOk({
      rows: page.rows,
      moreRecords: page.moreRecords,
      pageToken: page.nextPageToken,
    });
  });
}

const createSchema = z.object({
  First_Name: z.string().optional(),
  Last_Name: z.string().min(1, "Last_Name is required"),
  Mobile: z.string().optional(),
  Email: z.string().email().optional(),
  Date_of_Birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  Anniversary_Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tag: z.string().optional(),
});

// POST /api/leads  { Last_Name, First_Name?, Mobile?, Email?, Date_of_Birth?,
// Anniversary_Date?, tag? }  Creates a Zoho Lead and applies an optional tag.
export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid lead payload", 422, parsed.error.flatten());
    }
    const result = await createLead(parsed.data);
    return jsonOk(result, 201);
  });
}
