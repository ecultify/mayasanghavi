"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/page-header";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
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
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [searchInput, setSearchInput] = React.useState("");
  const [activeSearch, setActiveSearch] = React.useState("");
  const [searching, setSearching] = React.useState(false);

  async function runSearch(term: string) {
    setSearching(true);
    const res = await fetchLeadsAction(null, term || null);
    setSearching(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as LeadsPagePayload;
    setRows(data.rows);
    setMore(data.moreRecords);
    setToken(data.nextPageToken);
    setActiveSearch(term);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    runSearch("");
  }

  async function loadMore() {
    if (!token) return;
    setLoadingMore(true);
    const res = await fetchLeadsAction(token, activeSearch || null);
    setLoadingMore(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as LeadsPagePayload;
    setRows((prev) => [...prev, ...data.rows]);
    setMore(data.moreRecords);
    setToken(data.nextPageToken);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: search + add lead */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={onSearchSubmit} className="flex items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="lead-search">Search</Label>
            <Input
              id="lead-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, mobile, or email"
              className="sm:w-72"
            />
          </div>
          <Button type="submit" variant="outline" disabled={searching}>
            <Search className="h-4 w-4" />
            Search
          </Button>
          {activeSearch ? (
            <Button
              type="button"
              variant="ghost"
              onClick={clearSearch}
              disabled={searching}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </form>

        <AddLeadDialog onCreated={() => runSearch(activeSearch)} />
      </div>

      {/* States: loading, empty, data */}
      {searching ? (
        <div className="space-y-2 rounded-lg border p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            activeSearch
              ? `No leads match "${activeSearch}".`
              : "No leads found in Zoho CRM."
          }
        />
      ) : (
        <>
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
              {activeSearch ? ` matching "${activeSearch}"` : ""}
              {more ? " (more available)" : ""}.
            </p>
            {more ? (
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
