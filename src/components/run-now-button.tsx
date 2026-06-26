"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runNowAction } from "@/app/actions";

export function RunNowButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState<"run" | "dry" | null>(null);

  async function run(dryRun: boolean) {
    setPending(dryRun ? "dry" : "run");
    try {
      const res = await runNowAction({ dryRun });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data as {
        results: Array<{ matched: number; sent: number; failed: number }>;
      };
      const totals = data.results.reduce(
        (acc, r) => ({
          matched: acc.matched + r.matched,
          sent: acc.sent + r.sent,
          failed: acc.failed + r.failed,
        }),
        { matched: 0, sent: 0, failed: 0 },
      );
      if (dryRun) {
        toast.success(
          `Dry run complete. ${totals.matched} matched recipients (nothing sent).`,
        );
      } else {
        toast.success(
          `Run complete. Sent ${totals.sent}, failed ${totals.failed}, matched ${totals.matched}.`,
        );
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => run(true)}
        disabled={pending !== null}
      >
        <FlaskConical className="h-4 w-4" />
        {pending === "dry" ? "Running..." : "Dry run"}
      </Button>
      <Button onClick={() => run(false)} disabled={pending !== null}>
        <Play className="h-4 w-4" />
        {pending === "run" ? "Running..." : "Run all rules now"}
      </Button>
    </div>
  );
}
