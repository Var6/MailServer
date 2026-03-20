#!/bin/bash
set -e

# ── 1. Set hostname & domain in a writable copy ──────────────────────────────
cp /etc/postfix/main.cf /tmp/main.cf
sed -i "s|myhostname = .*|myhostname = ${MAIL_HOSTNAME:-mail.localhost}|" /tmp/main.cf
sed -i "s|mydomain   = .*|mydomain   = ${MAIL_DOMAIN:-localhost}|"   /tmp/main.cf
cp /tmp/main.cf /etc/postfix/main.cf

# ── 2. Postfix sanity check ──────────────────────────────────────────────────
postfix check

# ── 3. Start Postfix ─────────────────────────────────────────────────────────
exec "$@"
