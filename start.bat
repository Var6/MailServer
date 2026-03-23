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

:: ── Parse .env ───────────────────────────────────────────────────────────────
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  set "line=%%A"
  if "!line:~0,1!" NEQ "#" (
    if "%%A"=="SUPERADMIN_EMAIL"    set "SA_EMAIL=%%B"
    if "%%A"=="SUPERADMIN_PASSWORD" set "SA_PASS=%%B"
    if "%%A"=="SERVER_URL"          set "SERVER_URL=%%B"
  )
)

:: ── 0. Keep-awake (prevent sleep / hibernate) ────────────────────────────────
echo  [0/6] Starting keep-awake (sleep prevention)...
powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0scripts\keep-awake.ps1" >nul 2>&1 &
echo         Sleep prevention active.

:: ── 1. Check Docker (wait up to 3 min for Docker Desktop to start) ───────────
echo  [1/6] Waiting for Docker Desktop...
set DOCKER_WAIT=0
:wait_docker
docker info >nul 2>&1
if not errorlevel 1 goto docker_ready
set /a DOCKER_WAIT+=1
if %DOCKER_WAIT% GEQ 36 (
  echo.
  echo  [ERROR] Docker Desktop did not start after 3 minutes.
  echo          Open Docker Desktop manually, wait for the whale icon,
  echo          then run start.bat again.
  echo.
  pause & exit /b 1
)
timeout /t 5 /nobreak >nul
goto wait_docker
:docker_ready
echo         Docker is running.

:: ── 2. SSL certificate ───────────────────────────────────────────────────────
echo  [2/6] Checking SSL certificate...
docker run --rm -v mail_cert_data:/certs alpine sh -c ^
  "test -f /certs/fullchain.pem && echo EXISTS || (apk add -q --no-cache openssl && openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /certs/privkey.pem -out /certs/fullchain.pem -subj '/CN=mailserver' -q 2>/dev/null && cp /certs/fullchain.pem /certs/chain.pem && echo CREATED)" 2>nul
echo         Certificate ready.

:: ── 3. Tailscale Funnel (public HTTPS access) ────────────────────────────────
echo  [3/6] Enabling Tailscale Funnel...
where tailscale >nul 2>&1
if not errorlevel 1 (
  tailscale funnel --bg 8082 >nul 2>&1
  echo         Tailscale Funnel active on port 8082.
) else (
  "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8082 >nul 2>&1
  if not errorlevel 1 (
    echo         Tailscale Funnel active on port 8082.
  ) else (
    echo         [SKIP] Tailscale not found — public access unavailable.
  )
)

:: ── 4. Start all containers ───────────────────────────────────────────────────
echo  [4/6] Starting all containers...
docker compose -f docker-compose.yml -f docker-compose.apps.yml up -d
if errorlevel 1 (
  echo  [ERROR] Failed to start containers. Check Docker Desktop for details.
  pause & exit /b 1
)
echo         All containers started.

:: ── 5. Wait for API ───────────────────────────────────────────────────────────
echo  [5/6] Waiting for API to be ready...
:wait_api
curl -s http://localhost:3001/health 2>nul | findstr /c:"\"ok\"" >nul 2>&1
if errorlevel 1 (
  timeout /t 3 /nobreak >nul
  goto wait_api
)
echo         API is ready.

:: ── 6. First-run superadmin setup ────────────────────────────────────────────
echo  [6/6] Checking superadmin account...
curl -s http://localhost:3001/setup 2>nul | findstr /c:"true" >nul 2>&1
if not errorlevel 1 (
  echo         First run — creating superadmin...
  curl -s -X POST -H "Content-Type: application/json" ^
    -d "{\"email\":\"%SA_EMAIL%\",\"password\":\"%SA_PASS%\",\"displayName\":\"Super Admin\"}" ^
    http://localhost:3001/setup >nul 2>&1
  echo         Superadmin created: %SA_EMAIL%
) else (
  echo         Superadmin already exists.
)

:: ── Done ──────────────────────────────────────────────────────────────────────
echo.
echo  ================================================================
echo   YOUR MAIL SERVER IS RUNNING
echo.
echo   Local:         http://localhost:8082
echo   From anywhere: %SERVER_URL%
echo.
echo   MAIL PORTS:
echo     SMTP  587    IMAP  993    POP3  995
echo.
echo   Superadmin: %SA_EMAIL%
echo   Keep-awake: running in background (PC will not sleep)
echo.
echo   First time setup?
echo     Run as Admin: scripts\install-startup.ps1
echo     (registers start.bat to auto-run on every login)
echo  ================================================================
echo.

start %SERVER_URL%
echo  Press any key to view live logs (Ctrl+C to exit logs)...
pause >nul
docker compose -f docker-compose.yml -f docker-compose.apps.yml logs -f --tail=50
