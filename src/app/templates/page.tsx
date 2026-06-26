import { Suspense } from "react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { ToolbarSkeleton, TableSkeleton } from "@/components/skeletons";
import { TemplatesManager } from "@/components/templates/templates-manager";
import { getCachedTemplates } from "@/lib/cache";
import type { NormalizedTemplate } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

async function TemplatesData() {
  let templates: NormalizedTemplate[] = [];
  let error: string | null = null;
  try {
    templates = await getCachedTemplates();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  if (error) return <ErrorState message={error} />;
  return <TemplatesManager initialTemplates={templates} />;
}

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        title="WhatsApp templates"
        description="Create, review, and delete message templates. New templates go to Meta for approval before they can be sent."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <ToolbarSkeleton />
            <TableSkeleton rows={6} cols={6} />
          </div>
        }
      >
        <TemplatesData />
      </Suspense>
    </div>
  );
}
