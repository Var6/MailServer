#!/bin/bash
set -e

# ── 1. Set hostname & domain ────────────────────────────────────────────────
postconf -e "myhostname = ${MAIL_HOSTNAME:-mail.localhost}"
postconf -e "mydomain   = ${MAIL_DOMAIN:-localhost}"

# ── 2. Build virtual_domains hash map from the API ──────────────────────────
# The API exposes GET /internal/domains which returns a JSON array of active
# domain names.  We write them as a Postfix hash map (one per line, value OK)
# so Postfix knows which domains to accept mail for.
# Fall back to MAIL_DOMAIN if the API isn't reachable yet.

API_URL="${API_URL:-http://api:3000}"
DOMAINS_FILE="/etc/postfix/virtual_domains"

echo "Fetching active mail domains from API…"
if curl -sf \
     -H "X-Internal-Token: ${INTERNAL_AUTH_TOKEN}" \
     "${API_URL}/internal/domains" \
     -o /tmp/domains.json 2>/dev/null; then
  # Parse JSON array and write as hash map
  python3 -c "
import json, sys
domains = json.load(open('/tmp/domains.json'))
lines   = '\n'.join(f'{d}  OK' for d in domains if d)
print(lines if lines else '${MAIL_DOMAIN:-localhost}  OK')
" > "$DOMAINS_FILE"
  echo "Loaded $(wc -l < "$DOMAINS_FILE") domain(s) from API."
else
  echo "WARNING: API not reachable — using MAIL_DOMAIN fallback."
  echo "${MAIL_DOMAIN:-localhost}  OK" > "$DOMAINS_FILE"
fi

postmap hash:"$DOMAINS_FILE"

# ── 3. Copy pcre maps (bind-mounted from config/) ───────────────────────────
# Nothing needed — pcre maps are read directly from the file, no postmap needed.

# ── 4. Postfix sanity check ──────────────────────────────────────────────────
postfix check

# ── 5. Start Postfix ─────────────────────────────────────────────────────────
exec "$@"
