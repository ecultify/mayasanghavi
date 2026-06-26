import { PageHeader, ErrorState } from "@/components/page-header";
import { TestForm } from "@/components/test/test-form";
import { listTemplates } from "@/lib/meta/client";
import type { NormalizedTemplate } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

export default async function TestPage() {
  let templates: NormalizedTemplate[] = [];
  let error: string | null = null;
  try {
    templates = (await listTemplates()).filter(
      (t) => t.status.toUpperCase() === "APPROVED",
    );
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <PageHeader
        title="Manual test"
        description="Send one approved template to a single number right now. This writes to the delivery log."
      />
      {error ? <ErrorState message={error} /> : <TestForm templates={templates} />}
    </div>
  );
}
