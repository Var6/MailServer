#!/bin/bash
# ============================================================
#  setup-certificates.sh — Get SSL certs via Let's Encrypt
#  Run AFTER DNS records are pointing to your VIRTUAL_IP
# ============================================================
set -euo pipefail

source "$(dirname "$0")/../.env"
PROJECT_DIR="$(dirname "$(dirname "$0")")"
CERT_DIR="${GLUSTER_CERTS_PATH:-/gluster/certs}"

echo "==> Requesting certificates for:"
echo "    - ${MAIL_HOSTNAME}"
echo "    - cloud.${MAIL_DOMAIN}"
echo "    - office.${MAIL_DOMAIN}"
echo ""
echo "    Make sure DNS A records for these all point to ${VIRTUAL_IP}"
read -p "Press Enter to continue or Ctrl+C to abort..."

docker run --rm \
  -v "${CERT_DIR}:/etc/letsencrypt" \
  -v "/var/www/certbot:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "${CERTBOT_EMAIL}" \
    -d "${MAIL_HOSTNAME}" \
    -d "cloud.${MAIL_DOMAIN}" \
    -d "office.${MAIL_DOMAIN}"

# Symlink to where Postfix/Dovecot/Nginx expect them
LETSENCRYPT_PATH="${CERT_DIR}/live/${MAIL_HOSTNAME}"
ln -sf "${LETSENCRYPT_PATH}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
ln -sf "${LETSENCRYPT_PATH}/privkey.pem"   "${CERT_DIR}/privkey.pem"
ln -sf "${LETSENCRYPT_PATH}/chain.pem"     "${CERT_DIR}/chain.pem"

chmod 640 "${CERT_DIR}/privkey.pem"
chown root:docker "${CERT_DIR}/privkey.pem"

echo "==> Certificates obtained and symlinked to ${CERT_DIR}/"
echo "    GlusterFS will replicate them to Pi-2 automatically."
