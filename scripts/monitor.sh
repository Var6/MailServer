#!/bin/bash
# ============================================================
#  monitor.sh — Continuous monitoring with alerting
#  Run as systemd service or: nohup ./monitor.sh &
# ============================================================

source "$(dirname "$0")/../.env" 2>/dev/null || true
HEALTH_SCRIPT="$(dirname "$0")/health-check.sh"
INTERVAL="${MONITOR_INTERVAL:-60}"

send_alert() {
  local MSG="$1"
  echo "[ALERT] $MSG"
  # Email alert via Postfix
  echo "$MSG" | mail -s "[MailServer ALERT] $(hostname)" "${ALERT_EMAIL:-}" 2>/dev/null || true
  # Slack webhook (optional)
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-type: application/json" \
      -d "{\"text\": \":warning: [MailServer] $(hostname): $MSG\"}" || true
  fi
}

echo "Starting monitor (interval: ${INTERVAL}s)"

PREV_STATUS=0

while true; do
  if ! bash "$HEALTH_SCRIPT" > /tmp/health-output 2>&1; then
    CURRENT_STATUS=1
    if [ "$PREV_STATUS" -eq 0 ]; then
      send_alert "Health check FAILED on $(hostname):\n$(cat /tmp/health-output | tail -20)"
    fi
  else
    CURRENT_STATUS=0
    if [ "$PREV_STATUS" -eq 1 ]; then
      send_alert "Health check RECOVERED on $(hostname)"
    fi
  fi
  PREV_STATUS=$CURRENT_STATUS
  sleep "$INTERVAL"
done
