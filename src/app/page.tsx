import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ErrorState } from "@/components/page-header";
import { StatCardsSkeleton, CardSkeleton } from "@/components/skeletons";
import { RunNowButton } from "@/components/run-now-button";
import { getDayCounts } from "@/lib/services/logs";
import { listRules } from "@/lib/services/rules";
import { getCachedWabaHealth } from "@/lib/cache";
import { todayInRunTz, describeNextRun } from "@/lib/time";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function safe<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
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

// Each async section fetches independently and is wrapped in its own Suspense
// boundary, so the page shell renders instantly and slow integrations (Meta)
// stream in without blocking the rest of the page.
async function TodayCounts() {
  const counts = await safe(getDayCounts);
  if (!counts.ok) return <ErrorState message={counts.error} />;
  return (
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
  );
}

async function NextRunCard() {
  const rules = await safe(listRules);
  const enabled = rules.ok ? rules.data.filter((r) => r.enabled) : [];
  const nextRun =
    enabled.length > 0 ? describeNextRun(enabled[0].sendTime) : "No enabled rules";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next scheduled run</CardTitle>
        <CardDescription>
          The Railway cron service POSTs /api/run daily.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rules.ok ? (
          <>
            <p className="text-2xl font-semibold">{nextRun}</p>
            <p className="text-sm text-muted-foreground">
              {enabled.length} enabled rule{enabled.length === 1 ? "" : "s"} of{" "}
              {rules.data.length} total.
            </p>
          </>
        ) : (
          <ErrorState message={rules.error} />
        )}
      </CardContent>
    </Card>
  );
}

async function HealthCard() {
  const [health, counts] = await Promise.all([
    safe(getCachedWabaHealth),
    safe(getDayCounts),
  ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp account health</CardTitle>
        <CardDescription>Live from the Meta Cloud API.</CardDescription>
      </CardHeader>
      <CardContent>
        {health.ok ? (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Messaging tier</dt>
              <dd>
                <MessagingTier
                  tier={health.data.messagingLimitTier}
                  codeVerificationStatus={health.data.codeVerificationStatus}
                />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Quality rating</dt>
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
  );
}

export default function OverviewPage() {
  const today = todayInRunTz();

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Today is ${today} (${env.runTimezone()}).`}
        action={<RunNowButton />}
      />

      <section aria-label="Today's delivery counts" className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Today</h2>
        <Suspense fallback={<StatCardsSkeleton />}>
          <TodayCounts />
        </Suspense>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <NextRunCard />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <HealthCard />
        </Suspense>
      </div>
    </div>
  );
}

// Readable labels for Meta's messaging limit tiers.
const TIER_LABELS: Record<string, string> = {
  TIER_50: "50 per day",
  TIER_250: "250 per day",
  TIER_1K: "1,000 per day",
  TIER_10K: "10,000 per day",
  TIER_100K: "100,000 per day",
  TIER_UNLIMITED: "Unlimited",
};

// Meta omits messaging_limit_tier when no tier is assigned (typically when the
// number is not verified). Show a meaningful label instead of a bare "Unknown".
function MessagingTier({
  tier,
  codeVerificationStatus,
}: {
  tier: string | null;
  codeVerificationStatus: string | null;
}) {
  const value = (tier ?? "").trim();
  if (value) {
    return (
      <span className="font-medium">
        {TIER_LABELS[value.toUpperCase()] ?? value}
      </span>
    );
  }

  // No tier returned: explain why rather than showing "Unknown".
  if ((codeVerificationStatus ?? "").toUpperCase() !== "VERIFIED") {
    return (
      <span className="font-medium text-muted-foreground">
        Not set (number not verified)
      </span>
    );
  }
  return <span className="font-medium">Standard</span>;
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
