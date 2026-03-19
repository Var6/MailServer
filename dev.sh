#!/usr/bin/env bash
# ============================================================
#  dev.sh — Start MailServer in development mode
#  Usage:  bash dev.sh
#          bash dev.sh --install   (npm install first)
# ============================================================

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ── Colours ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── Install deps if requested ────────────────────────────────
if [[ "$1" == "--install" ]]; then
  echo -e "${CYAN}Installing backend dependencies…${RESET}"
  (cd "$BACKEND"  && npm install)
  echo -e "${CYAN}Installing frontend dependencies…${RESET}"
  (cd "$FRONTEND" && npm install)
fi

# ── Check .env files exist ───────────────────────────────────
if [[ ! -f "$BACKEND/.env" ]]; then
  echo -e "${YELLOW}⚠  No backend/.env found. Copying from backend/.env.example …${RESET}"
  if [[ -f "$BACKEND/.env.example" ]]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    echo -e "${YELLOW}   Edit backend/.env before running in production.${RESET}"
  else
    echo -e "${RED}✗  backend/.env.example not found. Create backend/.env manually.${RESET}"
    exit 1
  fi
fi

if [[ ! -f "$FRONTEND/.env" ]]; then
  if [[ -f "$FRONTEND/.env.example" ]]; then
    cp "$FRONTEND/.env.example" "$FRONTEND/.env"
  else
    # Write a minimal dev env
    echo "VITE_API_URL=http://localhost:3000" > "$FRONTEND/.env"
    echo "VITE_COLLABORA_ENABLED=true"       >> "$FRONTEND/.env"
  fi
fi

# ── Cleanup on Ctrl+C ────────────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}Shutting down…${RESET}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID"  2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  echo -e "${GREEN}Done.${RESET}"
}
trap cleanup INT TERM

# ── Start backend ─────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}▶ Starting backend${RESET}  (http://localhost:3000)"
(
  cd "$BACKEND"
  npm run dev 2>&1 | sed "s/^/$(printf '\033[0;36m')[backend]$(printf '\033[0m') /"
) &
BACKEND_PID=$!

# Give the API a moment to bind before the browser opens
sleep 1

# ── Start frontend ────────────────────────────────────────────
echo -e "${BOLD}${GREEN}▶ Starting frontend${RESET} (http://localhost:5173)"
(
  cd "$FRONTEND"
  npm run dev 2>&1 | sed "s/^/$(printf '\033[0;35m')[frontend]$(printf '\033[0m') /"
) &
FRONTEND_PID=$!

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Landing page  ${RESET}→  http://localhost:5173"
echo -e "  ${BOLD}User portal   ${RESET}→  http://localhost:5173/login"
echo -e "  ${BOLD}Admin portal  ${RESET}→  http://localhost:5173/admin/login"
echo -e "  ${BOLD}Super Admin   ${RESET}→  http://localhost:5173/superadmin/login"
echo -e "  ${BOLD}API           ${RESET}→  http://localhost:3000"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop both servers.${RESET}"
echo ""

wait
