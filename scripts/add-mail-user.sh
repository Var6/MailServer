#!/bin/bash
# ============================================================
#  add-mail-user.sh — Create a mail account in MongoDB
#  Usage: ./add-mail-user.sh email@yourdomain.com [quota_mb] ["Display Name"]
# ============================================================
set -euo pipefail

source "$(dirname "$0")/../.env"

EMAIL="${1:-}"
QUOTA="${2:-2048}"
DISPLAY_NAME="${3:-}"

if [ -z "$EMAIL" ]; then
  echo "Usage: $0 email@domain.com [quota_mb] [\"Display Name\"]"
  exit 1
fi

read -s -p "Password for ${EMAIL}: " PASSWORD
echo ""

echo "==> Creating user ${EMAIL} via API..."
RESPONSE=$(curl -s -X POST "http://localhost:3000/internal/auth-create" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_AUTH_TOKEN}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"quotaMb\":${QUOTA},\"displayName\":\"${DISPLAY_NAME}\"}")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "==> User ${EMAIL} created successfully (quota: ${QUOTA} MB)"
else
  echo "==> Fallback: creating user directly via Docker + Node..."
  docker exec mailserver-api node -e "
    const mongoose = require('mongoose');
    const argon2 = require('argon2');
    mongoose.connect('${MONGO_URI}').then(async () => {
      const { User, Domain } = require('./dist/models/User.js');
      const domain = '${EMAIL}'.split('@')[1];
      await Domain.findOneAndUpdate({name:domain},{name:domain,active:true},{upsert:true});
      const hash = await argon2.hash('${PASSWORD}',{type:argon2.argon2id});
      await User.findOneAndUpdate(
        {email:'${EMAIL}'},
        {email:'${EMAIL}',password:hash,domain,quotaMb:${QUOTA},displayName:'${DISPLAY_NAME}',active:true},
        {upsert:true,new:true}
      );
      console.log('User created');
      process.exit(0);
    }).catch(e=>{console.error(e);process.exit(1);});
  "
fi

echo "==> Creating mail directories..."
docker exec mailserver-dovecot mkdir -p "/var/mail/vhosts/${EMAIL#*@}/${EMAIL%@*}/cur"
docker exec mailserver-dovecot mkdir -p "/var/mail/vhosts/${EMAIL#*@}/${EMAIL%@*}/new"
docker exec mailserver-dovecot mkdir -p "/var/mail/vhosts/${EMAIL#*@}/${EMAIL%@*}/tmp"
docker exec mailserver-dovecot chown -R 5000:5000 "/var/mail/vhosts/${EMAIL#*@}"

echo "Done! User ${EMAIL} is ready."
