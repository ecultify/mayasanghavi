import { Suspense } from "react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { CardSkeleton } from "@/components/skeletons";
import { TestForm } from "@/components/test/test-form";
import { getCachedApprovedTemplates } from "@/lib/cache";
import type { NormalizedTemplate } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

async function TestData() {
  let templates: NormalizedTemplate[] = [];
  let error: string | null = null;
  try {
    templates = await getCachedApprovedTemplates();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  if (error) return <ErrorState message={error} />;
  return <TestForm templates={templates} />;
}

export default function TestPage() {
  return (
    <div>
      <PageHeader
        title="Manual test"
        description="Send one approved template to a single number right now. This writes to the delivery log."
      />
      <Suspense
        fallback={
          <div className="max-w-xl">
            <CardSkeleton lines={5} />
          </div>
        }
      >
        <TestData />
      </Suspense>
    </div>
  );
}
