@echo off
:: ============================================================
::  Install DuckDNS auto-update as a Windows Scheduled Task.
::  Run this ONCE as Administrator after filling in .env.
::  After that, your IP updates automatically every 5 minutes.
:: ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0.."

:: Parse .env
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  set "line=%%A"
  if "!line:~0,1!" NEQ "#" (
    if "%%A"=="DUCKDNS_TOKEN"     set "DUCKDNS_TOKEN=%%B"
    if "%%A"=="DUCKDNS_SUBDOMAIN" set "DUCKDNS_SUBDOMAIN=%%B"
  )
)

if "!DUCKDNS_TOKEN!"=="" (
  echo [ERROR] DUCKDNS_TOKEN not set in .env
  echo         Fill in DUCKDNS_TOKEN and DUCKDNS_SUBDOMAIN in .env first.
  pause & exit /b 1
)
if "!DUCKDNS_SUBDOMAIN!"=="" (
  echo [ERROR] DUCKDNS_SUBDOMAIN not set in .env
  pause & exit /b 1
)

echo Installing DuckDNS scheduled task...
echo   Subdomain : !DUCKDNS_SUBDOMAIN!.duckdns.org
echo   Interval  : every 5 minutes
echo.

set "SCRIPT=%~dp0..\scripts\ddns-update.ps1"
set "CMD=powershell.exe -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%SCRIPT%\" -Token \"!DUCKDNS_TOKEN!\" -Subdomain \"!DUCKDNS_SUBDOMAIN!\""

schtasks /delete /tn "MailServer-DDNS" /f >/dev/null 2>&1
schtasks /create ^
  /tn "MailServer-DDNS" ^
  /tr "%CMD%" ^
  /sc MINUTE ^
  /mo 5 ^
  /ru SYSTEM ^
  /rl HIGHEST ^
  /f

if errorlevel 1 (
  echo [ERROR] Failed to create scheduled task. Run this as Administrator.
  pause & exit /b 1
)

echo.
echo [OK] Scheduled task created.
echo      Your IP will auto-update every 5 minutes.
echo.
echo Running first update now...
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT%" -Token "!DUCKDNS_TOKEN!" -Subdomain "!DUCKDNS_SUBDOMAIN!"
echo.
pause
