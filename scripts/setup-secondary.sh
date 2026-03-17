#!/bin/bash
# ============================================================
#  setup-secondary.sh — Bootstrap Pi-2 (Secondary Node)
#  Run as root on Raspberry Pi OS Bookworm (64-bit)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
source "$PROJECT_DIR/.env"

echo "==> [1/7] Updating system and installing packages..."
apt-get update && apt-get upgrade -y
apt-get install -y \
  docker.io docker-compose-plugin \
  glusterfs-server \
  keepalived \
  haproxy \
  rsync curl wget git openssl ufw

echo "==> [2/7] Configuring Docker..."
usermod -aG docker pi || true
cat > /etc/docker/daemon.json <<EOF
{"mtu": 1450, "log-driver": "json-file", "log-opts": {"max-size": "50m","max-file": "3"}}
EOF
systemctl enable --now docker

echo "==> [3/7] Creating GlusterFS directories..."
mkdir -p /data/glusterfs/mail /data/glusterfs/nextcloud /data/glusterfs/certs
mkdir -p /gluster/mail /gluster/nextcloud /gluster/certs
systemctl enable --now glusterd

echo "==> [4/7] Configuring firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
for port in 25 465 587 143 993 80 443 4567 4568 4444 24007; do
  ufw allow $port/tcp
done
ufw allow 49152:49200/tcp
ufw allow from "$PI_PRIMARY_IP"
ufw --force enable

echo "==> [5/7] Installing Keepalived config (BACKUP)..."
cp "$PROJECT_DIR/config/keepalived/keepalived-secondary.conf" /etc/keepalived/keepalived.conf
sed -i "s/KEEPALIVED_SECRET_PLACEHOLDER/${KEEPALIVED_SECRET}/g" /etc/keepalived/keepalived.conf
sed -i "s/192.168.1.100/${VIRTUAL_IP}/g" /etc/keepalived/keepalived.conf

cat > /etc/keepalived/notify.sh <<'NOTIFY'
#!/bin/bash
STATE=$1
logger -t keepalived "Transitioning to state: $STATE"
NOTIFY
chmod +x /etc/keepalived/notify.sh
systemctl enable --now keepalived

echo "==> [6/7] Cloning project from primary (or use git)..."
echo "    NOTE: Make sure the project directory is synced to this Pi."
echo "    Easiest: git clone from your repo, then copy .env"

echo "==> [7/7] Building Docker images..."
cd "$PROJECT_DIR"
docker compose build
docker compose -f docker-compose.apps.yml build

echo ""
echo "===> Secondary setup complete!"
echo "Now go back to Pi-1 and run:"
echo "  gluster peer probe ${PI_SECONDARY_IP}"
echo "  scripts/setup-glusterfs.sh"
echo "  scripts/setup-galera.sh"
