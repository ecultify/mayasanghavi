#!/usr/bin/env bash
# =============================================================================
# cli.sh - terminal control surface for the Maya WhatsApp automation API.
#
# Reads ADMIN_TOKEN and BASE_URL from the environment (or .env.local).
# Every request is authed with Authorization: Bearer $ADMIN_TOKEN.
#
# Examples:
#   ./cli.sh rules:list
#   ./cli.sh run --dry
#   ./cli.sh run --date 2026-07-15
#   ./cli.sh send-test 918169921886 maya_birthday_wish Abhinav
#   ./cli.sh templates:list
#   ./cli.sh logs --date today
#   ./cli.sh health
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env.local if present (does not override already-exported vars).
if [[ -f "$SCRIPT_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(ADMIN_TOKEN|BASE_URL)=' "$SCRIPT_DIR/.env.local" || true)
  set +a
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "Error: ADMIN_TOKEN is not set. Export it or add it to .env.local." >&2
  exit 1
fi

AUTH=(-H "Authorization: Bearer $ADMIN_TOKEN")
JSON=(-H "Content-Type: application/json")

# Pretty-print JSON if jq is available, else raw.
pp() {
  if command -v jq >/dev/null 2>&1; then jq .; else cat; fi
}

req() {
  local method="$1"; shift
  local path="$1"; shift
  curl -sS -X "$method" "${AUTH[@]}" "$@" "$BASE_URL$path"
}

cmd="${1:-help}"; shift || true

case "$cmd" in
  rules:list)
    req GET /api/rules | pp
    ;;
  rules:create)
    # Usage: rules:create '<json body>'
    body="${1:?Provide a JSON body}"
    req POST /api/rules "${JSON[@]}" -d "$body" | pp
    ;;
  rules:update)
    # Usage: rules:update <id> '<json patch>'
    id="${1:?Provide rule id}"; body="${2:?Provide JSON patch}"
    req PATCH "/api/rules/$id" "${JSON[@]}" -d "$body" | pp
    ;;
  rules:delete)
    id="${1:?Provide rule id}"
    req DELETE "/api/rules/$id" | pp
    ;;
  run)
    # Flags: --dry, --rule <id>, --date <YYYY-MM-DD|today is default>
    qs=""
    dry="false"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --dry) dry="true"; shift ;;
        --rule) qs="${qs}&rule_id=$2"; shift 2 ;;
        --date) qs="${qs}&date=$2"; shift 2 ;;
        *) echo "Unknown flag: $1" >&2; exit 1 ;;
      esac
    done
    req POST "/api/run?dry_run=${dry}${qs}" | pp
    ;;
  send-test)
    # Usage: send-test <to> <template> [name] [headerImageUrl]
    to="${1:?Provide recipient number}"
    template="${2:?Provide template name}"
    name="${3:-}"
    img="${4:-}"
    body="{\"to\":\"$to\",\"template\":\"$template\""
    [[ -n "$name" ]] && body="$body,\"name\":\"$name\""
    [[ -n "$img" ]] && body="$body,\"headerImageUrl\":\"$img\""
    body="$body}"
    req POST /api/send-test "${JSON[@]}" -d "$body" | pp
    ;;
  templates:list)
    req GET /api/templates | pp
    ;;
  templates:create)
    body="${1:?Provide a JSON body}"
    req POST /api/templates "${JSON[@]}" -d "$body" | pp
    ;;
  templates:delete)
    name="${1:?Provide template name}"
    req DELETE "/api/templates?name=$name" | pp
    ;;
  templates:upload)
    # Usage: templates:upload <path-to-image>
    file="${1:?Provide an image path}"
    req POST /api/templates/upload-media -F "file=@$file" | pp
    ;;
  logs)
    # Flags: --date <today|YYYY-MM-DD>, --status <...>, --rule <id>
    qs=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --date) qs="${qs}&date=$2"; shift 2 ;;
        --status) qs="${qs}&status=$2"; shift 2 ;;
        --rule) qs="${qs}&rule_id=$2"; shift 2 ;;
        *) echo "Unknown flag: $1" >&2; exit 1 ;;
      esac
    done
    req GET "/api/logs?${qs#&}" | pp
    ;;
  health)
    req GET /api/waba/health | pp
    ;;
  help|*)
    cat <<'EOF'
Maya WhatsApp automation CLI

Usage: ./cli.sh <command> [args]

Commands:
  rules:list
  rules:create '<json>'
  rules:update <id> '<json patch>'
  rules:delete <id>
  run [--dry] [--rule <id>] [--date YYYY-MM-DD]
  send-test <to> <template> [name] [headerImageUrl]
  templates:list
  templates:create '<json>'
  templates:upload <image-path>
  templates:delete <name>
  logs [--date today|YYYY-MM-DD] [--status sent|failed|skipped_dupe|skipped_invalid] [--rule <id>]
  health

Env:
  BASE_URL      (default http://localhost:3000)
  ADMIN_TOKEN   (required; read from env or .env.local)
EOF
    ;;
esac
