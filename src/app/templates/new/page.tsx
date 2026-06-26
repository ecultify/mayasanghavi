import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TemplateForm } from "@/components/templates/template-form";

export const dynamic = "force-dynamic";

export default function NewTemplatePage() {
  return (
    <div>
      <PageHeader
        title="New template"
        description="Set everything up, then submit it to Meta for approval."
        action={
          <Button variant="outline" asChild>
            <Link href="/templates">
              <ArrowLeft className="h-4 w-4" />
              Back to templates
            </Link>
          </Button>
        }
      />
      <TemplateForm />
    </div>
  );
}
