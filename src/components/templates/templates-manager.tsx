"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  TemplateStatusBadge,
  CategoryBadge,
} from "@/components/status-badge";
import { EmptyState } from "@/components/page-header";
import { DeleteConfirm } from "@/components/delete-confirm";
import { CreateTemplateDialog } from "@/components/templates/create-template-dialog";
import { deleteTemplateAction } from "@/app/actions";
import type { NormalizedTemplate } from "@/lib/meta/types";

export function TemplatesManager({
  initialTemplates,
}: {
  initialTemplates: NormalizedTemplate[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);

  async function removeTemplate(name: string) {
    const res = await deleteTemplateAction(name);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Deleted template "${name}".`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.refresh()}
          aria-label="Refresh templates"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {initialTemplates.length === 0 ? (
        <EmptyState message="No templates yet. Create one to send branded birthday or anniversary wishes." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Body preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialTemplates.map((t) => (
                <TableRow key={`${t.name}-${t.language}`}>
                  <TableCell className="font-mono text-xs font-medium">
                    {t.name}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.hasHeaderImage ? (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Image header
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={t.category} />
                  </TableCell>
                  <TableCell>{t.language}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <TemplateStatusBadge status={t.status} />
                      {t.rejectedReason ? (
                        <p className="max-w-48 text-xs text-destructive">
                          {t.rejectedReason}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {t.bodyText || "(no body)"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DeleteConfirm
                        title={`Delete "${t.name}"?`}
                        description="This removes the template from Meta. Rules using it will fail until pointed at another template."
                        onConfirm={() => removeTemplate(t.name)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${t.name}`}
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

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
