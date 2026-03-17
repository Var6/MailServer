#!/bin/bash
# ============================================================
#  setup-mongodb-rs.sh — Initialize MongoDB Replica Set
#  Run from Pi-1 AFTER both MongoDB containers are running
# ============================================================
set -euo pipefail

source "$(dirname "$0")/../.env"
PROJECT_DIR="$(dirname "$(dirname "$0")")"

echo "==> Generating MongoDB keyfile (for replica set auth)..."
KEYFILE="$PROJECT_DIR/config/mongodb/keyfile"
if [ ! -f "$KEYFILE" ]; then
  openssl rand -base64 756 > "$KEYFILE"
  chmod 400 "$KEYFILE"
  chown 999:999 "$KEYFILE"  # MongoDB container user
fi

echo "==> Copying keyfile to Pi-2..."
scp "$KEYFILE" "pi@${PI_SECONDARY_IP}:~/mailserver/config/mongodb/keyfile"
ssh "pi@${PI_SECONDARY_IP}" "chmod 400 ~/mailserver/config/mongodb/keyfile && sudo chown 999:999 ~/mailserver/config/mongodb/keyfile"

echo "==> Starting MongoDB on both Pis (if not already running)..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d mongodb

echo "==> Waiting 15s for MongoDB to start..."
sleep 15

echo "==> Initializing replica set rs0..."
docker exec mailserver-mongodb mongosh \
  -u "${MONGO_ROOT_USER:-admin}" \
  -p "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --eval "
    rs.initiate({
      _id: 'rs0',
      members: [
        { _id: 0, host: '${PI_PRIMARY_IP}:27017',   priority: 2 },
        { _id: 1, host: '${PI_SECONDARY_IP}:27017', priority: 1 },
      ]
    })
  "

echo "==> Waiting 10s for election..."
sleep 10

echo "==> Replica set status:"
docker exec mailserver-mongodb mongosh \
  -u "${MONGO_ROOT_USER:-admin}" \
  -p "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --eval "rs.status()" | grep -E "name|stateStr|health"

echo ""
echo "==> MongoDB Replica Set initialized!"
echo "    Primary: ${PI_PRIMARY_IP}:27017"
echo "    Secondary: ${PI_SECONDARY_IP}:27017"
