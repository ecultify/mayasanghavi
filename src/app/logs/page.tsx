import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, ErrorState } from "@/components/page-header";
import { TableSkeleton } from "@/components/skeletons";
import { LogsTable, type LogRow } from "@/components/logs/logs-table";
import { listLogs } from "@/lib/services/logs";
import { listRules } from "@/lib/services/rules";
import { explainMetaError } from "@/lib/meta/errors";
import { todayInRunTz } from "@/lib/time";
import type { Rule } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

async function LogsData() {
  const today = todayInRunTz();
  let rows: LogRow[] = [];
  let rules: Rule[] = [];
  let error: string | null = null;

  try {
    const [logs, ruleList] = await Promise.all([
      listLogs({ date: today }),
      listRules(),
    ]);
    rows = logs.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      errorExplanation: r.errorCode ? explainMetaError(r.errorCode) : null,
    }));
    rules = ruleList;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (error) return <ErrorState message={error} />;
  return (
    <LogsTable
      initialRows={rows}
      rules={rules.map((r) => ({ id: r.id, name: r.name }))}
      defaultDate={today}
    />
  );
}

export default function LogsPage() {
  return (
    <div>
      <PageHeader
        title="Delivery logs"
        description="Every send attempt, with Meta error codes explained. Defaults to today."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-9 w-52" />
              <Skeleton className="h-9 w-24" />
            </div>
            <TableSkeleton rows={8} cols={6} />
          </div>
        }
      >
        <LogsData />
      </Suspense>
    </div>
  );
}
