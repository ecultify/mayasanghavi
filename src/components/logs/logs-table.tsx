"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SendStatusBadge } from "@/components/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState, ErrorState } from "@/components/page-header";
import { fetchLogsAction } from "@/app/actions";

export interface LogRow {
  id: number;
  ruleId: number | null;
  runDate: string;
  recipientName: string | null;
  recipientMobile: string;
  templateName: string;
  status: string;
  waMessageId: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  errorExplanation: string | null;
  createdAt: string;
}

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped_dupe", label: "Deduped" },
  { value: "skipped_invalid", label: "Invalid number" },
];

export function LogsTable({
  initialRows,
  rules,
}: {
  initialRows: LogRow[];
  rules: Array<{ id: number; name: string }>;
}) {
  const [rows, setRows] = React.useState<LogRow[]>(initialRows);
  // Empty date means show all logs across every date (the default view).
  const [date, setDate] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [ruleId, setRuleId] = React.useState("all");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function applyFilters(next?: {
    date?: string;
    status?: string;
    ruleId?: string;
  }) {
    const d = next?.date ?? date;
    const s = next?.status ?? status;
    const r = next?.ruleId ?? ruleId;
    setLoading(true);
    setError(null);
    const res = await fetchLogsAction({
      date: d || undefined,
      status: s === "all" ? undefined : (s as LogRow["status"] as never),
      ruleId: r === "all" ? undefined : Number(r),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setRows(res.data as LogRow[]);
  }

  function onDateChange(v: string) {
    setDate(v);
    applyFilters({ date: v });
  }
  function onStatusChange(v: string) {
    setStatus(v);
    applyFilters({ status: v });
  }
  function onRuleChange(v: string) {
    setRuleId(v);
    applyFilters({ ruleId: v });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="log-date">Date (optional filter)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="log-date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="sm:w-44"
            />
            {date ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDateChange("")}
                aria-label="Clear date filter"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="log-status">Status</Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger id="log-status" className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="log-rule">Rule</Label>
          <Select value={ruleId} onValueChange={onRuleChange}>
            <SelectTrigger id="log-rule" className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rules</SelectItem>
              {rules.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => applyFilters()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* States: loading, error, empty, data */}
      {loading ? (
        <div className="space-y-2 rounded-lg border p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            date || status !== "all" || ruleId !== "all"
              ? "No log entries match these filters."
              : "No log entries yet. They appear here after a run or a manual test."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap font-medium tabular-nums">
                    {row.runDate}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>{row.recipientName ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.recipientMobile}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.templateName}
                  </TableCell>
                  <TableCell>
                    <SendStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {row.errorCode ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-sm text-destructive underline decoration-dotted">
                              Error {row.errorCode}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {row.errorExplanation ?? row.errorDetail ?? "Error"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : row.waMessageId ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.waMessageId.slice(0, 18)}...
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
