"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2, Play } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/page-header";
import { DeleteConfirm } from "@/components/delete-confirm";
import {
  updateRuleAction,
  deleteRuleAction,
  runNowAction,
} from "@/app/actions";
import type { Rule } from "@/lib/db/schema";

export function RulesManager({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [togglingId, setTogglingId] = React.useState<number | null>(null);

  async function toggleEnabled(rule: Rule, enabled: boolean) {
    setTogglingId(rule.id);
    const res = await updateRuleAction(rule.id, { enabled });
    setTogglingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${rule.name} ${enabled ? "enabled" : "disabled"}.`);
    router.refresh();
  }

  async function removeRule(id: number, name: string) {
    const res = await deleteRuleAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Deleted rule "${name}".`);
    router.refresh();
  }

  async function runOne(rule: Rule) {
    toast.info(`Running "${rule.name}"...`);
    const res = await runNowAction({ ruleId: rule.id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as {
      results: Array<{ matched: number; sent: number; failed: number }>;
    };
    const r = data.results[0];
    toast.success(
      `"${rule.name}": matched ${r?.matched ?? 0}, sent ${r?.sent ?? 0}, failed ${r?.failed ?? 0}.`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {initialRules.length === 0 ? (
        <EmptyState message="No rules yet. Create your first birthday or anniversary rule to get started." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Send time</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    {rule.dateField === "Date_of_Birth"
                      ? "Birthday"
                      : "Anniversary"}
                  </TableCell>
                  <TableCell>{rule.module}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs">
                        {rule.templateName}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.hasNameVar ? (
                          <Badge variant="outline">Name var</Badge>
                        ) : null}
                        {rule.hasHeaderImage ? (
                          <Badge variant="outline">Image header</Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{rule.sendTime}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      disabled={togglingId === rule.id}
                      onCheckedChange={(v) => toggleEnabled(rule, v)}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Run ${rule.name} now`}
                              onClick={() => runOne(rule)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Run now</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${rule.name}`}
                        asChild
                      >
                        <Link href={`/rules/${rule.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteConfirm
                        title={`Delete "${rule.name}"?`}
                        description="This removes the rule. Past delivery logs are kept."
                        onConfirm={() => removeRule(rule.id, rule.name)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${rule.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                    </div>
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
