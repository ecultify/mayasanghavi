import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { TableSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { RulesManager } from "@/components/rules/rules-manager";
import { RunHistory } from "@/components/rules/run-history";
import { listRules } from "@/lib/services/rules";
import { listRunSummaries } from "@/lib/services/runs";

export const dynamic = "force-dynamic";

async function RulesData() {
  try {
    const rules = await listRules();
    return <RulesManager initialRules={rules} />;
  } catch (err) {
    return (
      <ErrorState message={err instanceof Error ? err.message : String(err)} />
    );
  }
}

async function RunHistoryData() {
  try {
    const rows = await listRunSummaries();
    return <RunHistory rows={rows} />;
  } catch (err) {
    return (
      <ErrorState message={err instanceof Error ? err.message : String(err)} />
    );
  }
}

export default function RulesPage() {
  return (
    <div className="space-y-10">
      <section>
        <PageHeader
          title="Automation rules"
          description="Each enabled rule queries Zoho daily and sends an approved WhatsApp template to every matching, deduped recipient."
          action={
            <Button asChild>
              <Link href="/rules/new">
                <Plus className="h-4 w-4" />
                New rule
              </Link>
            </Button>
          }
        />
        <Suspense fallback={<TableSkeleton rows={4} cols={7} />}>
          <RulesData />
        </Suspense>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Recent automation runs
          </h2>
          <p className="text-muted-foreground">
            When each rule ran and what happened in that execution (matched,
            sent, failed, deduped, invalid).
          </p>
        </div>
        <Suspense fallback={<TableSkeleton rows={5} cols={9} />}>
          <RunHistoryData />
        </Suspense>
      </section>
    </div>
  );
}
