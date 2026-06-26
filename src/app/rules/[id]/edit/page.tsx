import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/page-header";
import { CardSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { RuleForm } from "@/components/rules/rule-form";
import { getRule } from "@/lib/services/rules";
import { listTemplates } from "@/lib/meta/client";
import type { NormalizedTemplate } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

async function EditRuleData({ id }: { id: number }) {
  const rule = await getRule(id);
  if (!rule) {
    return <ErrorState message={`Rule ${id} was not found.`} />;
  }

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
    <RuleForm editing={rule} templates={templates} templatesError={templatesError} />
  );
}

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  return (
    <div>
      <PageHeader
        title="Edit rule"
        description="Update what triggers the message and which template to send."
        action={
          <Button variant="outline" asChild>
            <Link href="/rules">
              <ArrowLeft className="h-4 w-4" />
              Back to rules
            </Link>
          </Button>
        }
      />
      {Number.isInteger(id) && id > 0 ? (
        <Suspense
          fallback={
            <div className="grid gap-6 lg:grid-cols-2">
              <CardSkeleton lines={6} />
              <CardSkeleton lines={4} />
            </div>
          }
        >
          <EditRuleData id={id} />
        </Suspense>
      ) : (
        <ErrorState message="Invalid rule id." />
      )}
    </div>
  );
}
