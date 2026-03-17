#!/bin/bash
set -e

# Inject real password into SQL config
sed -i "s/DOVECOT_DB_PASS_PLACEHOLDER/${DOVECOT_DB_PASS}/g" \
    /etc/dovecot/dovecot-sql.conf.ext

exec "$@"
