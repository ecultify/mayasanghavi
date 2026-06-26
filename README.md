# Maya Sanghavi Jewels: WhatsApp Birthday and Anniversary Automation

A production-grade service that reads birthday and anniversary dates from Zoho
CRM, dedupes recipients, and sends approved WhatsApp templates directly through
the Meta Cloud API on a daily schedule. It ships with a management dashboard for
non-technical staff and a bearer-token-authed API that mirrors every action for
terminal use.

Built with Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Postgres
via Drizzle ORM, and a cron-triggered worker. Deployable on Railway.

---

## Table of contents

1. [Architecture](#architecture)
2. [Environment setup](#environment-setup)
3. [Local development](#local-development)
4. [Data model](#data-model)
5. [How the daily run works](#how-the-daily-run-works)
6. [API reference (with curl)](#api-reference)
7. [The CLI (cli.sh)](#the-cli)
8. [Creating an image-header template end to end](#image-header-template-flow)
9. [Registering the first birthday and anniversary rules](#first-rules)
10. [Railway deployment](#railway-deployment)
11. [Error code reference](#error-codes)

---

## Architecture

```
Zoho CRM (Contacts, Leads)             Meta WhatsApp Cloud API
        |  COQL month/day query                 |  send / templates / health
        v                                        v
   src/lib/zoho/client.ts             src/lib/meta/client.ts
        \                                       /
         \------------ src/lib/worker.ts ------/   normalize, dedupe, idempotency
                          |
                          v
                   Postgres (Drizzle)            rules, send_log, run_summary
                          |
          ----------------+------------------
          |                                  |
  Dashboard (server                  Bearer API /api/*
  components + actions)              (terminal, cron, automation)
```

- The dashboard reads data in server components and mutates through server
  actions, so the browser never holds a secret.
- The `/api/*` routes are authed with `Authorization: Bearer ADMIN_TOKEN` and
  power the CLI and the Railway cron job.
- Both layers call the same shared libraries (`worker`, Zoho client, Meta
  client, services), so behaviour is identical.

---

## Environment setup

All configuration is read from environment variables.

- `.env.example` is committed and documents every variable with safe,
  non-secret defaults.
- `.env.local` holds the real secret values and is gitignored. Never commit it.

Copy and fill in:

```bash
cp .env.example .env.local
```

| Variable             | Secret | Notes                                                            |
| -------------------- | ------ | ---------------------------------------------------------------- |
| `WA_PHONE_NUMBER_ID` | no     | Default `479129835283946`                                        |
| `WA_WABA_ID`         | no     | Default `488367757690178`                                        |
| `WA_APP_ID`          | no     | Default `1016104521118501`                                       |
| `WA_TOKEN`           | YES    | Long-lived Meta system user token                                |
| `ZOHO_CLIENT_ID`     | no     | Default `1000.22O4TPG5UST4YRMV59WPQZ3IJX4JJW`                     |
| `ZOHO_CLIENT_SECRET` | YES    | Zoho OAuth client secret                                         |
| `ZOHO_REFRESH_TOKEN` | YES    | Zoho OAuth refresh token                                         |
| `DATABASE_URL`       | YES    | Postgres connection string (from Railway Postgres)               |
| `ADMIN_TOKEN`        | YES    | Bearer token for the API. Generate with `openssl rand -hex 32`   |
| `RUN_TIMEZONE`       | no     | Default `Asia/Kolkata`. The daily run date and schedule use this |

> `DATABASE_URL` and `ADMIN_TOKEN` are intentionally left blank in `.env.local`.
> Both MUST be set before the app is usable. Locally, point `DATABASE_URL` at any
> Postgres instance and set `ADMIN_TOKEN` to any long random string. In
> production both are set in the Railway Variables panel.

Secret variables are never written to any committed file. In Railway they live
only in the service Variables panel.

---

## Local development

```bash
npm install

# 1. Set DATABASE_URL and ADMIN_TOKEN in .env.local first.

# 2. Create the schema in your database.
npm run db:push          # apply schema directly (dev)
# or
npm run db:generate      # write a SQL migration to ./drizzle
npm run db:push          # then push

# 3. Start the dashboard + API.
npm run dev              # http://localhost:3000
```

Scripts:

- `npm run dev` / `npm run build` / `npm run start`: Next.js.
- `npm run db:generate`: generate SQL migration files into `./drizzle`.
- `npm run db:push`: push the schema to `DATABASE_URL`.
- `npm run db:studio`: open Drizzle Studio.

---

## Data model

Three tables (see `src/lib/db/schema.ts`):

- `rules`: one automation rule (module, date field, template, name/image flags,
  send time, optional Zoho criteria).
- `send_log`: one row per recipient per rule per run. A unique index on
  `(rule_id, run_date, recipient_mobile)` gives idempotency. Statuses: `sent`,
  `failed`, `skipped_dupe`, `skipped_invalid`.
- `run_summary`: per-rule totals for a run (matched, sent, failed, deduped,
  skipped_invalid, duration).

---

## How the daily run works

`POST /api/run` (the cron target) does the following per enabled rule:

1. Query the rule's module(s) in Zoho with COQL, matching the month and day of
   the date field (year-independent recurring match). Applies optional criteria.
   Handles the 2000-row pagination limit with `page_token`.
2. Normalize each `Mobile` to E.164: strip non-digits, prefix `91` for 10-digit
   numbers, keep only `^91[6-9]\d{9}$`. Invalid numbers are logged
   `skipped_invalid`.
3. Dedupe across Leads and Contacts by normalized number. Extras are logged
   `skipped_dupe`. Each person gets exactly one message.
4. Idempotency: anyone already `sent` for this rule and run date is skipped.
5. Build the send payload: template name and language, plus a body name
   parameter when the template has a `{{1}}` variable, plus a header image
   parameter when the template has an image header.
6. Send, then log `wa_message_id` or `error_code` and `error_detail`.
7. Write a `run_summary`.

Query params:

- `?dry_run=true`: compute and return the recipient list, send nothing.
- `?date=YYYY-MM-DD`: run as if it were that date (defaults to today in
  `RUN_TIMEZONE`).
- `?rule_id=<id>`: run a single rule. Omit to run all enabled rules.

---

## API reference

Every endpoint requires `Authorization: Bearer $ADMIN_TOKEN` and returns clean
JSON shaped `{ "ok": true, "data": ... }` or `{ "ok": false, "error": ... }`.

Set up:

```bash
export BASE_URL=http://localhost:3000      # or your Railway URL
export ADMIN_TOKEN=your-admin-token
```

### Rules

```bash
# List
curl -H "Authorization: Bearer $ADMIN_TOKEN" $BASE_URL/api/rules

# Create
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Birthday wishes",
    "module": "both",
    "dateField": "Date_of_Birth",
    "templateName": "maya_birthday_wish",
    "templateLang": "en_US",
    "hasNameVar": true,
    "hasHeaderImage": false,
    "sendTime": "09:00"
  }' \
  $BASE_URL/api/rules

# Update (partial)
curl -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"enabled": false}' $BASE_URL/api/rules/1

# Delete
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" $BASE_URL/api/rules/1
```

### Run the worker

```bash
# Dry run, all enabled rules (returns the computed recipients, sends nothing)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/run?dry_run=true"

# Real run, all enabled rules
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/run"

# A single rule, on a specific date
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/run?rule_id=1&date=2026-07-15"
```

### Send a single test

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"918169921886","template":"maya_birthday_wish","lang":"en_US","name":"Abhinav"}' \
  $BASE_URL/api/send-test
```

### Logs

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/logs?date=today&status=failed"
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/logs?date=2026-07-15&rule_id=1"
```

### Templates

```bash
# List all templates with detected name var / image header
curl -H "Authorization: Bearer $ADMIN_TOKEN" $BASE_URL/api/templates

# Create (text or image header, optional buttons)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "maya_diwali_offer",
    "language": "en_US",
    "category": "MARKETING",
    "headerType": "NONE",
    "body": "Hi {{1}}, celebrate Diwali with 20% off at Maya Sanghavi Jewels.",
    "bodyExample": "Abhinav",
    "footer": "Maya Sanghavi Jewels",
    "buttons": [{"type": "URL", "text": "Shop now", "url": "https://mayasanghavi.com"}]
  }' \
  $BASE_URL/api/templates

# Upload a sample image, get a media handle (for image-header templates)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@/path/to/sample.jpg" \
  $BASE_URL/api/templates/upload-media

# Delete
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/templates?name=maya_diwali_offer"
```

### WABA health

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" $BASE_URL/api/waba/health
```

---

## The CLI

`cli.sh` reads `ADMIN_TOKEN` and `BASE_URL` from the environment or `.env.local`.

```bash
export BASE_URL=http://localhost:3000     # or Railway URL
# ADMIN_TOKEN read from .env.local automatically

./cli.sh rules:list
./cli.sh run --dry
./cli.sh run --date 2026-07-15
./cli.sh run --rule 1
./cli.sh send-test 918169921886 maya_birthday_wish Abhinav
./cli.sh templates:list
./cli.sh templates:upload ./sample.jpg
./cli.sh logs --date today
./cli.sh logs --status failed
./cli.sh health
```

Run `./cli.sh help` for the full list. Install `jq` for pretty output.

---

## Image-header template flow

To create a template with an image header (so the image shows at the top of
every message), Meta requires a sample image reviewed up front. The flow:

1. Open the dashboard, go to Templates, click New template.
2. Set the header to Image. An upload control appears.
3. Choose an image. The dashboard runs the Meta Resumable Upload
   (`POST /{WA_APP_ID}/uploads` to start a session, then `POST /{session_id}`
   with the bytes and header `Authorization: OAuth {WA_TOKEN}`) and receives a
   media handle. Progress and a preview are shown.
4. Fill in the body (use Insert variable for the `{{1}}` first-name token and
   provide a sample value), an optional footer, and optional buttons.
5. Submit. The media handle is placed in the template HEADER component example
   so the template passes review. The toast shows the returned status; refresh
   to see it flip to Approved or Rejected (with the rejection reason).

Via the API/CLI, do the two steps explicitly:

```bash
# 1. Upload, capture the handle
HANDLE=$(./cli.sh templates:upload ./birthday.jpg | jq -r '.data.handle')

# 2. Create the template referencing that handle
./cli.sh templates:create "{
  \"name\": \"maya_birthday_image\",
  \"language\": \"en_US\",
  \"category\": \"MARKETING\",
  \"headerType\": \"IMAGE\",
  \"headerImageHandle\": \"$HANDLE\",
  \"body\": \"Happy birthday {{1}}! Enjoy a gift from Maya Sanghavi Jewels.\",
  \"bodyExample\": \"Abhinav\",
  \"footer\": \"Maya Sanghavi Jewels\"
}"
```

When sending with an image header, the rule (or send-test) supplies a
`headerImageUrl`, which becomes the actual image for each message.

---

## First rules

There is already an approved `maya_birthday_wish` (en_US, MARKETING, one `{{1}}`
first-name variable) and a `maya_anniversary_wish` of the same shape. Register
the two daily rules:

```bash
# Birthday rule: Contacts + Leads, name variable, no image header.
./cli.sh rules:create '{
  "name": "Daily birthday wishes",
  "module": "both",
  "dateField": "Date_of_Birth",
  "templateName": "maya_birthday_wish",
  "templateLang": "en_US",
  "hasNameVar": true,
  "hasHeaderImage": false,
  "sendTime": "09:00"
}'

# Anniversary rule.
./cli.sh rules:create '{
  "name": "Daily anniversary wishes",
  "module": "both",
  "dateField": "Anniversary_Date",
  "templateName": "maya_anniversary_wish",
  "templateLang": "en_US",
  "hasNameVar": true,
  "hasHeaderImage": false,
  "sendTime": "09:00"
}'

# Verify with a dry run for today.
./cli.sh run --dry
```

You can also create and edit rules in the dashboard Rules page; selecting a
template there auto-detects whether it needs a name variable or an image header.

---

## Railway deployment

You need one Postgres database and two services from this repo: a web service
and a cron service.

### 1. Create Postgres

In your Railway project, add a Postgres plugin. Copy its connection string; you
will use it as `DATABASE_URL`.

### 2. Web service (dashboard + API)

1. Create a service from this repo. Railway detects `railway.json` (Nixpacks,
   `npm run build`, `npm run start`).
2. Set these variables in the service Variables panel (never commit them):
   - `DATABASE_URL` (from the Postgres plugin)
   - `ADMIN_TOKEN` (a long random string, e.g. `openssl rand -hex 32`)
   - `WA_TOKEN`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`
   - Non-secret defaults can be left to `.env.example` values or set explicitly:
     `WA_PHONE_NUMBER_ID`, `WA_WABA_ID`, `WA_APP_ID`, `ZOHO_CLIENT_ID`,
     `RUN_TIMEZONE`.
3. Deploy. Then apply the schema once. Either run `npm run db:push` locally with
   `DATABASE_URL` pointed at the Railway database, or run it as a one-off command
   in Railway.

### 3. Cron service (daily run)

1. Create a second service from the same repo.
2. Override its start command to:
   ```
   node scripts/cron-run.mjs
   ```
3. Set its variables:
   - `APP_URL` = the public URL of the web service (e.g.
     `https://maya-web.up.railway.app`)
   - `ADMIN_TOKEN` = the same token as the web service
4. Set its Cron Schedule. Railway cron runs in UTC, so for 09:00 in
   `Asia/Kolkata` (UTC+5:30) use:
   ```
   30 3 * * *
   ```
   `30 3 * * *` UTC equals `09:00` Asia/Kolkata. If you change `RUN_TIMEZONE`,
   recompute this. The worker itself stamps `run_date` using `RUN_TIMEZONE`, so
   the logged date always reflects the brand's local day.

The cron service makes one authenticated `POST /api/run` and exits. The web
service does the actual Zoho query and WhatsApp sends.

> Security note: secret env vars are set only in the Railway Variables panel and
> are never committed to the repo. `.env.local` is gitignored. Consider placing
> the web service behind Railway's private networking or an auth proxy if the
> dashboard should not be public.

---

## Error codes

Failed sends log a Meta error code. The dashboard Logs page and the
`/api/logs` response include a human-readable explanation. Common codes:

| Code   | Meaning                                                          |
| ------ | --------------------------------------------------------------- |
| 131049 | Frequency cap (Meta limited marketing sends to this user)       |
| 131026 | Undeliverable (number cannot receive WhatsApp)                  |
| 132001 | Template missing or not approved                                |
| 132000 | Parameter count mismatch                                        |
| 190    | Access token expired or invalid (regenerate `WA_TOKEN`)         |

See `src/lib/meta/errors.ts` for the full map.
