import { unstable_cache } from "next/cache";
import { listTemplates, getWabaHealth } from "@/lib/meta/client";
import { listLeadsPage } from "@/lib/zoho/client";

// Caching layer for the external integrations (Meta and Zoho). Dashboard views
// read through these cached wrappers so repeated page loads do not hit the Meta
// or Zoho APIs and risk rate limits. Each entry is cached for 6 hours and then
// refreshed automatically on the next request (stale while revalidate). Writes
// invalidate the matching tag so fresh data appears immediately after a change.
//
// The worker (POST /api/run) deliberately does NOT use these caches: the daily
// send reads live Zoho data through queryRecipients so it never sends on stale
// records.

export const SIX_HOURS_SECONDS = 6 * 60 * 60; // 21600

export const CACHE_TAGS = {
  templates: "meta-templates",
  wabaHealth: "waba-health",
  leads: "zoho-leads",
} as const;

// All Meta message templates (approved and otherwise).
export const getCachedTemplates = unstable_cache(
  async () => listTemplates(),
  ["meta-templates"],
  { revalidate: SIX_HOURS_SECONDS, tags: [CACHE_TAGS.templates] },
);

// Approved templates only (the dropdowns for rules and the manual test).
export async function getCachedApprovedTemplates() {
  const templates = await getCachedTemplates();
  return templates.filter((t) => t.status.toUpperCase() === "APPROVED");
}

// WhatsApp phone number health (tier, quality, verification).
export const getCachedWabaHealth = unstable_cache(
  async () => getWabaHealth(),
  ["waba-health"],
  { revalidate: SIX_HOURS_SECONDS, tags: [CACHE_TAGS.wabaHealth] },
);

// One page of Zoho leads, cached per (pageToken, search) combination.
export const getCachedLeadsPage = unstable_cache(
  async (pageToken?: string | null, search?: string | null) =>
    listLeadsPage(pageToken, search),
  ["zoho-leads"],
  { revalidate: SIX_HOURS_SECONDS, tags: [CACHE_TAGS.leads] },
);
