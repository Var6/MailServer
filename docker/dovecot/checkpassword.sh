#!/bin/bash
# ============================================================
#  Dovecot checkpassword script
#  Called by Dovecot for every auth attempt.
#  Reads username/password from fd 3, calls API, sets env vars.
# ============================================================

# Load env vars (Dovecot auth-worker doesn't inherit parent env)
# shellcheck source=/dev/null
[ -f /etc/dovecot/checkpassword.env ] && . /etc/dovecot/checkpassword.env

# Read from file descriptor 3 (Dovecot checkpassword protocol: username\0password\0...)
IFS= read -r -d '' USERNAME <&3 || true
IFS= read -r -d '' PASSWORD <&3 || true

API_URL="${INTERNAL_API_URL:-http://api:3000}"
TOKEN="${INTERNAL_AUTH_TOKEN:-change-me-internal-secret}"

LOCAL="${USERNAME%@*}"
DOMAIN="${USERNAME#*@}"
HOME_DIR="/var/mail/vhosts/${DOMAIN}/${LOCAL}"

# If no password supplied this is a userdb-only lookup (e.g. LMTP delivery)
# Just check the user exists; no credential verification needed.
if [ -z "$PASSWORD" ]; then
  EXIST=$(curl -s --max-time 5 \
    "${API_URL}/internal/virtual-user?email=${USERNAME}" \
    -H "X-Internal-Token: ${TOKEN}")
  OK=$(echo "$EXIST" | grep -o '"exists":true' || true)
  if [ -z "$OK" ]; then
    exit 1
  fi
  export HOME="$HOME_DIR"
  export EXTRA="uid=5000 gid=5000 home=$HOME_DIR mail=maildir:$HOME_DIR"
  exec "$@"
fi

# Full authentication: verify username + password via API
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

# Extract home dir from response if provided
HOME_DIR=$(echo "$RESPONSE" | grep -oP '"home":"\K[^"]+' || echo "$HOME_DIR")

# Set Dovecot userdb environment variables
export HOME="$HOME_DIR"
export EXTRA="uid=5000 gid=5000 home=$HOME_DIR mail=maildir:$HOME_DIR"

# Exec the next program in the chain (usually dovecot-auth-userdb)
exec "$@"
