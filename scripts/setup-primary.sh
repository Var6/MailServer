#!/bin/bash
# ============================================================
#  setup-primary.sh — Bootstrap Pi-1 (Primary Node)
#  Run as root on Raspberry Pi OS Bookworm (64-bit)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
source "$PROJECT_DIR/.env"

echo "==> [1/10] Updating system packages..."
apt-get update && apt-get upgrade -y

echo "==> [2/10] Installing required packages..."
apt-get install -y \
  docker.io docker-compose-plugin \
  glusterfs-server \
  keepalived \
  haproxy \
  rsync \
  curl wget git \
  openssl \
  ufw

echo "==> [3/10] Configuring Docker..."
usermod -aG docker pi || true
cat > /etc/docker/daemon.json <<EOF
{
  "mtu": 1450,
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" }
}
EOF
systemctl enable --now docker

echo "==> [4/10] Creating GlusterFS directories..."
mkdir -p /data/glusterfs/mail /data/glusterfs/nextcloud /data/glusterfs/certs
mkdir -p /gluster/mail /gluster/nextcloud /gluster/certs

echo "==> [5/10] Starting GlusterFS daemon..."
systemctl enable --now glusterd

echo "==> [6/10] Configuring firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 25/tcp    # SMTP
ufw allow 465/tcp   # SMTPS
ufw allow 587/tcp   # Submission
ufw allow 143/tcp   # IMAP
ufw allow 993/tcp   # IMAPS
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 4567/tcp  # Galera
ufw allow 4568/tcp  # Galera IST
ufw allow 4444/tcp  # Galera SST
ufw allow 24007/tcp # GlusterFS daemon
ufw allow 49152:49200/tcp # GlusterFS bricks
# Allow Pi-2 full access
ufw allow from "$PI_SECONDARY_IP"
ufw --force enable

echo "==> [7/10] Installing Keepalived config (MASTER)..."
cp "$PROJECT_DIR/config/keepalived/keepalived-primary.conf" /etc/keepalived/keepalived.conf
sed -i "s/KEEPALIVED_SECRET_PLACEHOLDER/${KEEPALIVED_SECRET}/g" /etc/keepalived/keepalived.conf
sed -i "s/192.168.1.100/${VIRTUAL_IP}/g" /etc/keepalived/keepalived.conf

# Keepalived notify script
cat > /etc/keepalived/notify.sh <<'NOTIFY'
#!/bin/bash
STATE=$1
logger -t keepalived "Transitioning to state: $STATE"
case $STATE in
  MASTER)
    logger -t keepalived "Now MASTER — VIP acquired"
    ;;
  BACKUP)
    logger -t keepalived "Now BACKUP — VIP released"
    ;;
  FAULT)
    logger -t keepalived "FAULT state"
    ;;
esac
NOTIFY
chmod +x /etc/keepalived/notify.sh
systemctl enable --now keepalived

echo "==> [8/10] Setting up GlusterFS volumes (wait for peer probe with secondary)..."
echo "    NOTE: Run this step AFTER secondary Pi is online and glusterd is running there."
echo "    Then run: gluster peer probe ${PI_SECONDARY_IP}"
echo "    Then run: scripts/setup-glusterfs.sh"

echo "==> [9/10] Generating DKIM key..."
mkdir -p "$PROJECT_DIR/config/dkim"
if [ ! -f "$PROJECT_DIR/config/dkim/${MAIL_DOMAIN}.mail.key" ]; then
  openssl genrsa -out "$PROJECT_DIR/config/dkim/${MAIL_DOMAIN}.mail.key" 2048
  openssl rsa -in "$PROJECT_DIR/config/dkim/${MAIL_DOMAIN}.mail.key" \
              -pubout -out "$PROJECT_DIR/config/dkim/${MAIL_DOMAIN}.mail.pub"
  echo ""
  echo "===> DKIM Public Key (add to DNS as TXT record: mail._domainkey.${MAIL_DOMAIN})"
  echo "v=DKIM1; k=rsa; p=$(grep -v '^-' "$PROJECT_DIR/config/dkim/${MAIL_DOMAIN}.mail.pub" | tr -d '\n')"
  echo ""
fi

echo "==> [10/10] Pulling Docker images and building..."
cd "$PROJECT_DIR"
docker compose build
docker compose -f docker-compose.apps.yml build

echo ""
echo "===> Setup-primary complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your real values"
echo "  2. Run setup-secondary.sh on Pi-2"
echo "  3. Run scripts/setup-glusterfs.sh from here"
echo "  4. Run scripts/setup-galera.sh to bootstrap DB cluster"
echo "  5. Run scripts/setup-certificates.sh for SSL"
echo "  6. Run scripts/add-mail-user.sh admin@${MAIL_DOMAIN} to create first user"
echo "  7. docker compose up -d && docker compose -f docker-compose.apps.yml up -d"
