@echo off
setlocal EnableDelayedExpansion
title MailServer — Starting...
color 0A
cd /d "%~dp0"

echo.
echo  ================================================================
echo   Enterprise Mail Server  ^|  Multi-Tenant  ^|  All-in-One
echo  ================================================================
echo.

:: ── Parse .env for SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SERVER_URL ─────────
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  set "line=%%A"
  if "!line:~0,1!" NEQ "#" (
    if "%%A"=="SUPERADMIN_EMAIL"    set "SA_EMAIL=%%B"
    if "%%A"=="SUPERADMIN_PASSWORD" set "SA_PASS=%%B"
    if "%%A"=="SERVER_URL"          set "SERVER_URL=%%B"
  )
)

:: ── 1. Check Docker ───────────────────────────────────────────────────────────
echo  [1/5] Checking Docker...
docker info >/dev/null 2>&1
if errorlevel 1 (
  echo.
  echo  [ERROR] Docker Desktop is not running.
  echo          Open Docker Desktop, wait for the whale icon to stop animating,
  echo          then double-click start.bat again.
  echo.
  pause & exit /b 1
)
echo         Docker is running.

:: ── 2. Generate self-signed SSL certificate if missing ───────────────────────
echo  [2/5] Checking SSL certificate...
docker run --rm -v mail_cert_data:/certs alpine sh -c ^
  "test -f /certs/fullchain.pem && echo EXISTS || (apk add -q --no-cache openssl && openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /certs/privkey.pem -out /certs/fullchain.pem -subj '/CN=mailserver' -q 2>/dev/null && cp /certs/fullchain.pem /certs/chain.pem && echo CREATED)" 2>/dev/null
echo         Certificate ready.

:: ── 3. Enable Tailscale Funnel (public access through CGNAT) ─────────────────
echo  [3/6] Enabling Tailscale Funnel...
where tailscale >nul 2>&1
if not errorlevel 1 (
  tailscale funnel --bg 8082 >nul 2>&1
  echo         Tailscale Funnel active.
) else (
  "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8082 >nul 2>&1
  if not errorlevel 1 (
    echo         Tailscale Funnel active.
  ) else (
    echo         [SKIP] Tailscale not found — public access via Tailscale unavailable.
  )
)

:: ── 4. Start all containers ───────────────────────────────────────────────────
echo  [4/6] Starting all containers (this takes ~30s first time)...
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d
if errorlevel 1 (
  echo  [ERROR] Failed to start containers. Check Docker Desktop for details.
  pause & exit /b 1
)
echo         All containers started.

:: ── 5. Wait for API to be ready ───────────────────────────────────────────────
echo  [5/6] Waiting for API to be ready...
:wait_api
curl -s http://localhost:3001/health 2>/dev/null | findstr /c:"\"ok\"" >/dev/null 2>&1
if errorlevel 1 (
  timeout /t 3 /nobreak >/dev/null
  goto wait_api
)
echo         API is ready.

:: ── 6. Create superadmin on first run ────────────────────────────────────────
echo  [6/6] Checking superadmin account...
curl -s http://localhost:3001/setup 2>/dev/null | findstr /c:"true" >/dev/null 2>&1
if not errorlevel 1 (
  echo         First run detected — creating superadmin...
  curl -s -X POST -H "Content-Type: application/json" ^
    -d "{\"email\":\"%SA_EMAIL%\",\"password\":\"%SA_PASS%\",\"displayName\":\"Super Admin\"}" ^
    http://localhost:3001/setup >/dev/null 2>&1
  echo         Superadmin created: %SA_EMAIL%
) else (
  echo         Superadmin already exists.
)

:: ── Done ──────────────────────────────────────────────────────────────────────
echo.
echo  ================================================================
echo   YOUR MAIL SERVER IS RUNNING
echo.
echo   Local access:    http://localhost:8082
echo   From anywhere:   https://rishabh.tail09a4d0.ts.net
echo   Superadmin:      %SA_EMAIL%
echo.
echo   MAIL PORTS (for email clients):
echo     SMTP: localhost:587  (or your Tailscale IP:587)
echo     IMAP: localhost:993  (or your Tailscale IP:993)
echo.
echo   DNS (tenants point their domain registrar):
echo     mail.theirdomain.com   A   ^<your Tailscale IP^>
echo     theirdomain.com        MX  mail.theirdomain.com  (priority 10)
echo  ================================================================
echo.

start https://rishabh.tail09a4d0.ts.net
echo  Press any key to view live container logs (Ctrl+C to stop logs)...
pause >/dev/null
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f --tail=50
