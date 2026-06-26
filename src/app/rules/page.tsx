import { Suspense } from "react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { ToolbarSkeleton, TableSkeleton } from "@/components/skeletons";
import { RulesManager } from "@/components/rules/rules-manager";
import { listRules } from "@/lib/services/rules";
import { listTemplates } from "@/lib/meta/client";
import type { NormalizedTemplate } from "@/lib/meta/types";
import type { Rule } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

async function RulesData() {
  let rules: Rule[] = [];
  let rulesError: string | null = null;
  try {
    rules = await listRules();
  } catch (err) {
    rulesError = err instanceof Error ? err.message : String(err);
  }
  if (rulesError) return <ErrorState message={rulesError} />;

  // A Meta failure should not block rule editing; the dropdown just stays empty.
  let templates: NormalizedTemplate[] = [];
  let templatesError: string | null = null;
  try {
    templates = (await listTemplates()).filter(
      (t) => t.status.toUpperCase() === "APPROVED",
    );
  } catch (err) {
    templatesError = err instanceof Error ? err.message : String(err);
  }

  return (
    <RulesManager
      initialRules={rules}
      templates={templates}
      templatesError={templatesError}
    />
  );
}

export default function RulesPage() {
  return (
    <div>
      <PageHeader
        title="Automation rules"
        description="Each enabled rule queries Zoho daily and sends an approved WhatsApp template to every matching, deduped recipient."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <ToolbarSkeleton />
            <TableSkeleton rows={5} cols={7} />
          </div>
        }
      >
        <RulesData />
      </Suspense>
    </div>
  );
}
