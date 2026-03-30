#!/bin/bash
set -e

# Ensure vmail owns the mail store (named volume, Linux FS)
chown -R vmail:vmail /var/mail/vhosts 2>/dev/null || true

# Pass API URL and token to checkpassword script via environment
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://api:3000}"
export INTERNAL_AUTH_TOKEN="${INTERNAL_AUTH_TOKEN:-change-me-internal-secret}"

# Write env to a source file that the checkpassword script can use
cat > /etc/dovecot/checkpassword.env <<EOF
export INTERNAL_API_URL="${INTERNAL_API_URL}"
export INTERNAL_AUTH_TOKEN="${INTERNAL_AUTH_TOKEN}"
EOF

exec "$@"
