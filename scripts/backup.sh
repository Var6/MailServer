#!/bin/bash
# ============================================================
#  backup.sh — Backup mail data to external location
#  Cron: 0 2 * * * /path/to/mailserver/scripts/backup.sh
# ============================================================
set -euo pipefail

source "$(dirname "$0")/../.env" 2>/dev/null || true

BACKUP_DIR="${BACKUP_DIR:-/mnt/backup/mailserver}"
DATE=$(date +%Y%m%d_%H%M%S)
DEST="${BACKUP_DIR}/${DATE}"

mkdir -p "$DEST"

echo "[$(date)] Starting backup to $DEST"

# 1. MariaDB dump
echo "  Dumping MariaDB..."
docker exec mailserver-mariadb mariadb-dump \
  -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  --all-databases --single-transaction \
  > "${DEST}/databases.sql.gz"

# 2. Mail data (GlusterFS is already replicated, this is an off-node copy)
echo "  Syncing mail data..."
rsync -az --delete /gluster/mail/ "${DEST}/mail/"

# 3. Nextcloud data
echo "  Syncing Nextcloud data..."
rsync -az --delete /gluster/nextcloud/ "${DEST}/nextcloud/"

# 4. Configs
echo "  Backing up configs..."
rsync -az "$(dirname "$(dirname "$0")")/config/" "${DEST}/config/"

# Clean up backups older than 14 days
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + || true

echo "[$(date)] Backup complete: $DEST"
