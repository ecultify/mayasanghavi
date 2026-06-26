import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import type { RunSummaryRow } from "@/lib/services/runs";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatWhen(iso: string): string {
  // Render in a compact, locale-aware way (date and time).
  const d = new Date(iso);
  return d.toLocaleString();
}

// Read-only history of automation executions: when each rule ran and the
// outcome (matched, sent, failed, deduped, invalid) plus how long it took.
export function RunHistory({ rows }: { rows: RunSummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState message="No automation runs yet. Runs appear here after the daily job or a manual run." />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Run date</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead className="text-right">Matched</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Deduped</TableHead>
            <TableHead className="text-right">Invalid</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatWhen(r.createdAt)}
              </TableCell>
              <TableCell className="tabular-nums">{r.runDate}</TableCell>
              <TableCell className="font-medium">
                {r.ruleName ?? "(deleted rule)"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.matched}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.sent > 0 ? (
                  <Badge variant="success">{r.sent}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.failed > 0 ? (
                  <Badge variant="destructive">{r.failed}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.deduped}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.skippedInvalid}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatDuration(r.durationMs)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
