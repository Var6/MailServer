#!/bin/bash
# ============================================================
#  setup-galera.sh — Bootstrap MariaDB Galera Cluster
#  Run from Pi-1 AFTER both nodes have the containers built
# ============================================================
set -euo pipefail

source "$(dirname "$0")/../.env"
PROJECT_DIR="$(dirname "$(dirname "$0")")"

echo "==> Patching galera.cnf with real values..."
GALERA_CFG="$PROJECT_DIR/config/mariadb/galera.cnf"
GALERA_CFG_RUNTIME="/tmp/galera.cnf.runtime"

cp "$GALERA_CFG" "$GALERA_CFG_RUNTIME"
sed -i "s/GALERA_CLUSTER_ADDRESS_PLACEHOLDER/gcomm:\/\/${PI_PRIMARY_IP},${PI_SECONDARY_IP}/g" "$GALERA_CFG_RUNTIME"
sed -i "s/GALERA_NODE_NAME_PLACEHOLDER/${PI_HOSTNAME}/g" "$GALERA_CFG_RUNTIME"
sed -i "s/GALERA_NODE_ADDRESS_PLACEHOLDER/${PI_PRIMARY_IP}/g" "$GALERA_CFG_RUNTIME"
sed -i "s/MYSQL_ROOT_PASSWORD_PLACEHOLDER/${MYSQL_ROOT_PASSWORD}/g" "$GALERA_CFG_RUNTIME"
cp "$GALERA_CFG_RUNTIME" "$GALERA_CFG"

echo "==> Step 1: Bootstrap first Galera node (Pi-1)..."
echo "    Starting MariaDB with --wsrep-new-cluster..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" stop mariadb || true
docker run --rm --network mailnet \
  -v "${GLUSTER_MAIL_PATH:-/gluster/mail}/db:/var/lib/mysql" \
  -v "$PROJECT_DIR/config/mariadb/my.cnf:/etc/mysql/conf.d/my.cnf:ro" \
  -v "$PROJECT_DIR/config/mariadb/galera.cnf:/etc/mysql/conf.d/galera.cnf:ro" \
  -v "$PROJECT_DIR/config/mariadb/initdb:/docker-entrypoint-initdb.d:ro" \
  -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
  -e MYSQL_DATABASE="$MYSQL_DATABASE" \
  -e MYSQL_USER="$MYSQL_USER" \
  -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
  --name mariadb-bootstrap \
  -d mariadb:11 \
  --wsrep-new-cluster

echo "    Waiting 30s for primary to initialize..."
sleep 30

echo "==> Step 2: Bring up MariaDB normally (it will join the cluster)..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d mariadb

echo ""
echo "===> Galera bootstrap complete on Pi-1!"
echo ""
echo "Now on Pi-2, start MariaDB normally (it will auto-join):"
echo "  docker compose -f docker-compose.yml up -d mariadb"
echo ""
echo "Verify cluster status:"
echo "  docker exec mailserver-mariadb mariadb -uroot -p${MYSQL_ROOT_PASSWORD} -e \"SHOW STATUS LIKE 'wsrep_cluster_size'\""
