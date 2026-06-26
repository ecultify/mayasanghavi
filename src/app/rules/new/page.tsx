import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CardSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { RuleForm } from "@/components/rules/rule-form";
import { listTemplates } from "@/lib/meta/client";
import type { NormalizedTemplate } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

async function NewRuleData() {
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
    <RuleForm editing={null} templates={templates} templatesError={templatesError} />
  );
}

export default function NewRulePage() {
  return (
    <div>
      <PageHeader
        title="New rule"
        description="Choose what triggers the message and which approved template to send."
        action={
          <Button variant="outline" asChild>
            <Link href="/rules">
              <ArrowLeft className="h-4 w-4" />
              Back to rules
            </Link>
          </Button>
        }
      />
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-2">
            <CardSkeleton lines={6} />
            <CardSkeleton lines={4} />
          </div>
        }
      >
        <NewRuleData />
      </Suspense>
    </div>
  );
}
