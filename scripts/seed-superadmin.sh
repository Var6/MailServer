#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# seed-superadmin.sh
# One-time script to create the superadmin account in MongoDB.
# Run AFTER docker-compose is up and the API container is healthy.
#
# Usage:
#   SUPERADMIN_EMAIL=superadmin@yourdomain.com \
#   SUPERADMIN_PASS=ChangeMe123! \
#   ./scripts/seed-superadmin.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

EMAIL="${SUPERADMIN_EMAIL:-superadmin@localhost}"
PASS="${SUPERADMIN_PASS:-ChangeMe123!}"

# Default: talk directly to MongoDB container
MONGO_URI="${MONGO_URI:-mongodb://mailserver:mailpassword@localhost:27017/mailserver?authSource=mailserver}"

echo "Creating superadmin: $EMAIL"

# Use mongosh if available, otherwise fall back to docker exec
if command -v mongosh &>/dev/null; then
  mongosh "$MONGO_URI" --eval "
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('${PASS}', 12);
    db.users.updateOne(
      { email: '${EMAIL}' },
      { \$set: { email: '${EMAIL}', password: hash, role: 'superadmin',
                 domain: '${EMAIL#*@}', quotaMb: 1024, active: true,
                 createdAt: new Date() } },
      { upsert: true }
    );
    print('Done — superadmin upserted.');
  "
else
  # Run inside the mongodb container
  docker exec -i mailserver-mongodb mongosh mailserver --eval "
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('${PASS}', 12);
    db.users.updateOne(
      { email: '${EMAIL}' },
      { \\\$set: { email: '${EMAIL}', password: hash, role: 'superadmin',
                  domain: '${EMAIL#*@}', quotaMb: 1024, active: true,
                  createdAt: new Date() } },
      { upsert: true }
    );
    print('Done — superadmin upserted.');
  "
fi

echo ""
echo "Superadmin created!"
echo "  Email:    $EMAIL"
echo "  Password: $PASS"
echo ""
echo "Log in at https://mail.yourdomain.com/login"
