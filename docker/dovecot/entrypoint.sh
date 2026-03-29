#!/bin/bash
set -e

# On Windows NTFS bind-mounts only root can write — ensure root ownership
chown -R root:root /var/mail/vhosts 2>/dev/null || true
chmod -R 755 /var/mail/vhosts 2>/dev/null || true

# Pass API URL and token to checkpassword script via environment
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://api:3000}"
export INTERNAL_AUTH_TOKEN="${INTERNAL_AUTH_TOKEN:-change-me-internal-secret}"

# Write env to a source file that the checkpassword script can use
cat > /etc/dovecot/checkpassword.env <<EOF
export INTERNAL_API_URL="${INTERNAL_API_URL}"
export INTERNAL_AUTH_TOKEN="${INTERNAL_AUTH_TOKEN}"
EOF

exec "$@"
