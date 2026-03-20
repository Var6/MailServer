#!/bin/bash
set -e

# ── 1. Set hostname & domain ────────────────────────────────────────────────
postconf -e "myhostname = ${MAIL_HOSTNAME:-mail.localhost}"
postconf -e "mydomain   = ${MAIL_DOMAIN:-localhost}"

# ── 2. Postfix sanity check ──────────────────────────────────────────────────
postfix check

# ── 3. Start Postfix ─────────────────────────────────────────────────────────
exec "$@"
