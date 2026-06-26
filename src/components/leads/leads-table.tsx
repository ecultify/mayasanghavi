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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/page-header";
import { fetchLeadsAction } from "@/app/actions";
import type { LeadRow } from "@/lib/zoho/client";

interface LeadsPagePayload {
  rows: LeadRow[];
  moreRecords: boolean;
  nextPageToken: string | null;
}

function fullName(lead: LeadRow): string {
  const name = [lead.First_Name, lead.Last_Name].filter(Boolean).join(" ").trim();
  return name || "(no name)";
}

export function LeadsTable({
  initialRows,
  initialMore,
  initialToken,
}: {
  initialRows: LeadRow[];
  initialMore: boolean;
  initialToken: string | null;
}) {
  const [rows, setRows] = React.useState<LeadRow[]>(initialRows);
  const [more, setMore] = React.useState(initialMore);
  const [token, setToken] = React.useState<string | null>(initialToken);
  const [loading, setLoading] = React.useState(false);

  async function loadMore() {
    if (!token) return;
    setLoading(true);
    const res = await fetchLeadsAction(token);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as LeadsPagePayload;
    setRows((prev) => [...prev, ...data.rows]);
    setMore(data.moreRecords);
    setToken(data.nextPageToken);
  }

  if (rows.length === 0) {
    return (
      <EmptyState message="No leads found in Zoho CRM." />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Anniversary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{fullName(lead)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {lead.Mobile ?? "-"}
                </TableCell>
                <TableCell className="text-sm">{lead.Email ?? "-"}</TableCell>
                <TableCell className="tabular-nums">
                  {lead.Date_of_Birth ?? "-"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {lead.Anniversary_Date ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {rows.length} lead{rows.length === 1 ? "" : "s"}
          {more ? " (more available)" : ""}.
        </p>
        {more ? (
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
