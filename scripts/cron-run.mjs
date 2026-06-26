#!/usr/bin/env node
// Railway cron entrypoint. Runs once and exits.
// POSTs /api/run (all enabled rules) on the web service, authed with ADMIN_TOKEN.
//
// Required env (set in the Railway cron service):
//   APP_URL       full base URL of the web service, e.g. https://maya.up.railway.app
//   ADMIN_TOKEN   same bearer token as the web service
//
// Railway cron runs in UTC. 09:00 Asia/Kolkata is 03:30 UTC, so schedule "30 3 * * *".

const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
const token = process.env.ADMIN_TOKEN;

if (!appUrl) {
  console.error("APP_URL is not set. Point it at the web service base URL.");
  process.exit(1);
}
if (!token) {
  console.error("ADMIN_TOKEN is not set.");
  process.exit(1);
}

const url = `${appUrl}/api/run`;
console.log(`[cron] POST ${url}`);

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  console.log(`[cron] status ${res.status}`);
  console.log(text);
  if (!res.ok) process.exit(1);
} catch (err) {
  console.error("[cron] request failed:", err);
  process.exit(1);
}
