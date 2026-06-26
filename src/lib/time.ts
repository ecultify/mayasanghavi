import { env } from "@/lib/env";

// Return YYYY-MM-DD for "now" in the configured run timezone. Used as the
// canonical run_date so idempotency aligns with the brand's local day.
export function todayInRunTz(): string {
  return dateInTz(new Date());
}

export function dateInTz(d: Date): string {
  const tz = env.runTimezone();
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Parse a YYYY-MM-DD string into month (1-12) and day (1-31). Throws on bad input.
export function parseRunDate(dateStr: string): { month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) {
    throw new Error(`Invalid date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid date "${dateStr}". Month/day out of range.`);
  }
  return { month, day };
}

// Compute the next scheduled run as a human string, given send_time HH:MM.
export function describeNextRun(sendTime: string): string {
  const tz = env.runTimezone();
  return `${sendTime} ${tz} (daily)`;
}
