#!/bin/bash
# ============================================================
#  health-check.sh — Check all services
# ============================================================

source "$(dirname "$0")/../.env" 2>/dev/null || true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "  ${GREEN}[OK]${NC}   $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; FAILED=$((FAILED+1)); }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

FAILED=0

echo ""
echo "=== MailServer Health Check ==="
echo ""

# Docker containers
echo "-- Docker Containers --"
for svc in mailserver-postfix mailserver-dovecot mailserver-rspamd mailserver-clamav mailserver-mariadb mailserver-redis mailserver-api mailserver-webmail mailserver-nextcloud mailserver-nginx; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null || echo "not found")
  if [ "$STATUS" = "running" ]; then
    pass "$svc"
  else
    fail "$svc ($STATUS)"
  fi
done

echo ""
echo "-- Network Ports --"

# SMTP
nc -z -w3 localhost 25 2>/dev/null && pass "SMTP :25" || fail "SMTP :25"
nc -z -w3 localhost 587 2>/dev/null && pass "Submission :587" || fail "Submission :587"

# IMAP
nc -z -w3 localhost 993 2>/dev/null && pass "IMAPS :993" || fail "IMAPS :993"

# HTTP/HTTPS
curl -sk -o /dev/null -w "%{http_code}" https://localhost/ 2>/dev/null | grep -q "200\|301\|302" \
  && pass "HTTPS :443" || fail "HTTPS :443"

# API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
[ "$API_STATUS" = "200" ] && pass "API :3000" || fail "API :3000 (got $API_STATUS)"

echo ""
echo "-- GlusterFS --"
if command -v gluster &>/dev/null; then
  for VOL in mail nextcloud certs; do
    STATUS=$(gluster volume status "$VOL" 2>/dev/null | grep -c "Online" || echo "0")
    [ "$STATUS" -gt "0" ] && pass "gluster:$VOL" || fail "gluster:$VOL"
  done
else
  warn "gluster not installed on this host"
fi

echo ""
echo "-- Keepalived VIP --"
ip addr show | grep -q "${VIRTUAL_IP:-192.168.1.100}" \
  && pass "VIP ${VIRTUAL_IP} present (this is MASTER)" \
  || warn "VIP ${VIRTUAL_IP} not present (this is BACKUP — OK if primary is up)"

echo ""
echo "-- MariaDB Galera --"
CLUSTER_SIZE=$(docker exec mailserver-mariadb mariadb \
  -uroot -p"${MYSQL_ROOT_PASSWORD:-}" -sNe \
  "SHOW STATUS LIKE 'wsrep_cluster_size'" 2>/dev/null | awk '{print $2}' || echo "0")
[ "$CLUSTER_SIZE" = "2" ] && pass "Galera cluster size: 2" || warn "Galera cluster size: $CLUSTER_SIZE (expected 2)"

echo ""
if [ "$FAILED" -eq "0" ]; then
  echo -e "${GREEN}All checks passed!${NC}"
else
  echo -e "${RED}${FAILED} check(s) failed!${NC}"
  exit 1
fi
