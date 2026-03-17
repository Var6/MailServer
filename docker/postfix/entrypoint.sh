#!/bin/bash
set -e

# Substitute placeholder passwords in mysql config files with real env vars
for f in /etc/postfix/mysql-*.cf; do
  sed -i "s/MYSQL_PASSWORD_PLACEHOLDER/${MYSQL_PASSWORD}/g" "$f"
done

# Set hostname
postconf -e "myhostname = ${MAIL_HOSTNAME}"
postconf -e "mydomain = ${MAIL_DOMAIN}"

# Ensure Postfix queue dirs are correct
postfix check

exec "$@"
