import { Suspense } from "react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { TableSkeleton } from "@/components/skeletons";
import { LeadsTable } from "@/components/leads/leads-table";
import { getCachedLeadsPage } from "@/lib/cache";

export const dynamic = "force-dynamic";

async function LeadsData() {
  try {
    const page = await getCachedLeadsPage();
    return (
      <LeadsTable
        initialRows={page.rows}
        initialMore={page.moreRecords}
        initialToken={page.nextPageToken}
      />
    );
  } catch (err) {
    return (
      <ErrorState message={err instanceof Error ? err.message : String(err)} />
    );
  }
}

export default function LeadsPage() {
  return (
    <div>
      <PageHeader
        title="Leads"
        description="Zoho CRM leads, ordered by last name. Use Load more to page through them."
      />
      <Suspense fallback={<TableSkeleton rows={8} cols={5} />}>
        <LeadsData />
      </Suspense>
    </div>
  );
}
