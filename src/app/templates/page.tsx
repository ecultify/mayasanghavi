import { PageHeader, ErrorState } from "@/components/page-header";
import { TemplatesManager } from "@/components/templates/templates-manager";
import { listTemplates } from "@/lib/meta/client";
import type { NormalizedTemplate } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: NormalizedTemplate[] = [];
  let error: string | null = null;
  try {
    templates = await listTemplates();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp templates"
        description="Create, review, and delete message templates. New templates go to Meta for approval before they can be sent."
      />
      {error ? (
        <ErrorState message={error} />
      ) : (
        <TemplatesManager initialTemplates={templates} />
      )}
    </div>
  );
}
