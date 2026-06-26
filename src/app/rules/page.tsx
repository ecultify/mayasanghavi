import { PageHeader, ErrorState } from "@/components/page-header";
import { RulesManager } from "@/components/rules/rules-manager";
import { listRules } from "@/lib/services/rules";
import { listTemplates } from "@/lib/meta/client";
import type { NormalizedTemplate } from "@/lib/meta/types";
import type { Rule } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  let rules: Rule[] = [];
  let rulesError: string | null = null;
  try {
    rules = await listRules();
  } catch (err) {
    rulesError = err instanceof Error ? err.message : String(err);
  }

  // Templates power the dropdown; a Meta failure should not block rule editing.
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
    <div>
      <PageHeader
        title="Automation rules"
        description="Each enabled rule queries Zoho daily and sends an approved WhatsApp template to every matching, deduped recipient."
      />
      {rulesError ? (
        <ErrorState message={rulesError} />
      ) : (
        <RulesManager
          initialRules={rules}
          templates={templates}
          templatesError={templatesError}
        />
      )}
    </div>
  );
}
