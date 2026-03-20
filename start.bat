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

:: ── 3. Start all containers ───────────────────────────────────────────────────
echo  [3/5] Starting all containers (this takes ~30s first time)...
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d
if errorlevel 1 (
  echo  [ERROR] Failed to start containers. Check Docker Desktop for details.
  pause & exit /b 1
)
echo         All containers started.

:: ── 4. Wait for API to be ready ───────────────────────────────────────────────
echo  [4/5] Waiting for API to be ready...
:wait_api
curl -s http://localhost:3001/health 2>/dev/null | findstr /c:"\"ok\"" >/dev/null 2>&1
if errorlevel 1 (
  timeout /t 3 /nobreak >/dev/null
  goto wait_api
)
echo         API is ready.

:: ── 5. Create superadmin on first run ────────────────────────────────────────
echo  [5/5] Checking superadmin account...
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
echo   Local access:    https://localhost
echo   From anywhere:   %SERVER_URL%
echo   Superadmin:      %SA_EMAIL%
echo.
echo   PORT FORWARDING (do this once in your router):
echo     80   → your PC's local IP (HTTP redirect)
echo     443  → your PC's local IP (webmail + LibreOffice)
echo     25   → your PC's local IP (receive email from internet)
echo     587  → your PC's local IP (SMTP send)
echo     143  → your PC's local IP (IMAP)
echo     993  → your PC's local IP (IMAP SSL)
echo.
echo   DNS (tenant tells their domain registrar):
echo     mail.theirdomain.com   A   %SERVER_URL:https://=%
echo     theirdomain.com        MX  mail.theirdomain.com
echo  ================================================================
echo.

start https://localhost
echo  Press any key to view live container logs (Ctrl+C to stop logs)...
pause >/dev/null
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f --tail=50
