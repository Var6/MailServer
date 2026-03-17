#!/bin/bash
# ============================================================
#  setup-glusterfs.sh — Create GlusterFS replicated volumes
#  Run from Pi-1 AFTER both Pis have glusterd running
#  and are peered (gluster peer probe PI_SECONDARY_IP)
# ============================================================
set -euo pipefail

source "$(dirname "$0")/../.env"

PI1="$PI_PRIMARY_IP"
PI2="$PI_SECONDARY_IP"

echo "==> Creating GlusterFS replicated volumes..."

for VOL in mail nextcloud certs; do
  echo "  Creating volume: $VOL"
  gluster volume create "$VOL" replica 2 \
    "${PI1}:/data/glusterfs/${VOL}" \
    "${PI2}:/data/glusterfs/${VOL}" \
    force || echo "  (volume $VOL may already exist)"

  gluster volume start "$VOL" || echo "  (volume $VOL may already be started)"

  # Performance tuning for Raspberry Pi
  gluster volume set "$VOL" performance.cache-size 128MB
  gluster volume set "$VOL" performance.io-thread-count 16
  gluster volume set "$VOL" network.ping-timeout 10
done

echo "==> Mounting GlusterFS volumes on this host..."
for VOL in mail nextcloud certs; do
  MOUNT_POINT="/gluster/$VOL"
  if ! mountpoint -q "$MOUNT_POINT"; then
    mount -t glusterfs "localhost:/${VOL}" "$MOUNT_POINT"
  fi
  # Add to fstab for persistence
  if ! grep -q "glusterfs.*${VOL}" /etc/fstab; then
    echo "localhost:/${VOL}  ${MOUNT_POINT}  glusterfs  defaults,_netdev  0  0" >> /etc/fstab
  fi
done

echo "==> GlusterFS status:"
gluster volume status

echo "==> Done! GlusterFS volumes are mounted at /gluster/{mail,nextcloud,certs}"
