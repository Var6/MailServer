#!/bin/bash
set -e

# ── 1. Work on a writable copy ───────────────────────────────────────────────
cp /etc/postfix/main.cf /tmp/main.cf

# Substitute hostname, domain, and API IP (all on the writable /tmp copy)
sed -i "s|myhostname = .*|myhostname = ${MAIL_HOSTNAME:-mail.localhost}|" /tmp/main.cf
sed -i "s|mydomain   = .*|mydomain   = ${MAIL_DOMAIN:-localhost}|"        /tmp/main.cf

echo "Postfix TCP map using Docker hostname: api:10023"

cp /tmp/main.cf /etc/postfix/main.cf

# ── 2. Configure external relay if env vars are set (once only) ─────────────
if [ -n "${SMTP_RELAY_HOST}" ] && [ -n "${SMTP_RELAY_PASSWORD}" ]; then
  RELAY_USER="${SMTP_RELAY_USER:-apikey}"
  echo "[${SMTP_RELAY_HOST}]:587 ${RELAY_USER}:${SMTP_RELAY_PASSWORD}" > /etc/postfix/sasl_passwd
  postmap /etc/postfix/sasl_passwd
  chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db

  if ! grep -q "^relayhost = " /etc/postfix/main.cf; then
    cat >> /etc/postfix/main.cf <<EOF

# ── External relay (injected by entrypoint) ──────────────────────────────────
relayhost = [${SMTP_RELAY_HOST}]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
EOF
    echo "SMTP relay configured: ${SMTP_RELAY_HOST}"
  else
    echo "SMTP relay already configured — skipping append"
  fi
fi

# ── 3. Postfix sanity check ──────────────────────────────────────────────────
postfix check

# ── 4. Start Postfix ─────────────────────────────────────────────────────────
exec "$@"
