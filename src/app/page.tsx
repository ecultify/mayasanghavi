import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ErrorState } from "@/components/page-header";
import { RunNowButton } from "@/components/run-now-button";
import { getDayCounts } from "@/lib/services/logs";
import { listRules } from "@/lib/services/rules";
import { getWabaHealth } from "@/lib/meta/client";
import { todayInRunTz, describeNextRun } from "@/lib/time";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// Each data source is fetched independently so one failing integration (for
// example Meta) does not blank the whole page.
async function safe<T>(fn: () => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "destructive" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function OverviewPage() {
  const today = todayInRunTz();
  const [counts, rules, health] = await Promise.all([
    safe(getDayCounts),
    safe(listRules),
    safe(getWabaHealth),
  ]);

  const enabledRules = rules.ok ? rules.data.filter((r) => r.enabled) : [];
  const nextRun =
    enabledRules.length > 0
      ? describeNextRun(enabledRules[0].sendTime)
      : "No enabled rules";

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Today is ${today} (${env.runTimezone()}).`}
        action={<RunNowButton />}
      />

      {/* Today's counts */}
      <section aria-label="Today's delivery counts" className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Today</h2>
        {counts.ok ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Matched" value={counts.data.matched} />
            <StatCard label="Sent" value={counts.data.sent} tone="success" />
            <StatCard
              label="Failed"
              value={counts.data.failed}
              tone={counts.data.failed > 0 ? "destructive" : "default"}
            />
            <StatCard label="Deduped" value={counts.data.deduped} />
          </div>
        ) : (
          <ErrorState message={counts.error} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next run */}
        <Card>
          <CardHeader>
            <CardTitle>Next scheduled run</CardTitle>
            <CardDescription>
              The Railway cron service POSTs /api/run daily.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{nextRun}</p>
            <p className="text-sm text-muted-foreground">
              {enabledRules.length} enabled rule
              {enabledRules.length === 1 ? "" : "s"} of{" "}
              {rules.ok ? rules.data.length : 0} total.
            </p>
          </CardContent>
        </Card>

        {/* WABA health */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp account health</CardTitle>
            <CardDescription>Live from the Meta Cloud API.</CardDescription>
          </CardHeader>
          <CardContent>
            {health.ok ? (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Messaging tier
                  </dt>
                  <dd className="font-medium">
                    {health.data.messagingLimitTier ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Quality rating
                  </dt>
                  <dd>
                    <QualityBadge rating={health.data.qualityRating} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Sent today</dt>
                  <dd className="font-medium tabular-nums">
                    {counts.ok ? counts.data.sent : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Number</dt>
                  <dd className="font-medium">
                    {health.data.displayPhoneNumber ?? "-"}
                  </dd>
                </div>
              </dl>
            ) : (
              <ErrorState message={health.error} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QualityBadge({ rating }: { rating: string | null }) {
  if (!rating) return <Badge variant="outline">Unknown</Badge>;
  const r = rating.toUpperCase();
  if (r === "GREEN" || r === "HIGH")
    return <Badge variant="success">Green</Badge>;
  if (r === "YELLOW" || r === "MEDIUM")
    return <Badge variant="warning">Yellow</Badge>;
  if (r === "RED" || r === "LOW")
    return <Badge variant="destructive">Red</Badge>;
  return <Badge variant="outline">{rating}</Badge>;
}
