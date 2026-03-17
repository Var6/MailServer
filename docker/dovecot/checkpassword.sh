#!/bin/bash
# ============================================================
#  Dovecot checkpassword script
#  Called by Dovecot for every auth attempt.
#  Reads username/password from fd 3, calls API, sets env vars.
# ============================================================

# Read from file descriptor 3 (Dovecot checkpassword protocol)
read -d '' -r CREDENTIALS <&3 || true

# Split by NUL byte  (username\0password\0timestamp\0)
USERNAME=$(echo -n "$CREDENTIALS" | cut -d$'\0' -f1)
PASSWORD=$(echo -n "$CREDENTIALS" | cut -d$'\0' -f2)

API_URL="${INTERNAL_API_URL:-http://api:3000}"
TOKEN="${INTERNAL_AUTH_TOKEN:-change-me-internal-secret}"

# Call our API
RESPONSE=$(curl -s --max-time 5 \
  -X POST "${API_URL}/internal/auth" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${TOKEN}" \
  -d "{\"email\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

OK=$(echo "$RESPONSE" | grep -o '"ok":true' || true)

if [ -z "$OK" ]; then
  # Auth failed
  exit 1
fi

# Extract fields from JSON (simple grep approach, no jq dependency)
HOME_DIR=$(echo "$RESPONSE" | grep -oP '"home":"\K[^"]+' || echo "/var/mail/vhosts/${USERNAME#*@}/${USERNAME%@*}")

# Set Dovecot userdb environment variables
export HOME="$HOME_DIR"
export EXTRA="userdb_home=$HOME_DIR userdb_uid=5000 userdb_gid=5000 userdb_mail=maildir:$HOME_DIR"

# Exec the next program in the chain (usually dovecot-auth-userdb)
exec "$@"
